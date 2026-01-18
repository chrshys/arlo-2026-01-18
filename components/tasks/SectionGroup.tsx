'use client'

import { ChevronRight, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { DraggableTaskRow } from './DraggableTaskRow'
import { QuickAddTask } from './QuickAddTask'
import { Button } from '@/components/ui/button'
import { Id } from '@/convex/_generated/dataModel'
import { DraggableNoteRow } from '@/components/notes/DraggableNoteRow'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useDndMonitor, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createDragId, parseDragId } from '@/lib/drag-utils'

interface Task {
  _id: Id<'tasks'>
  title: string
  status: 'pending' | 'completed'
  priority?: 'none' | 'low' | 'medium' | 'high' | null
  dueDate?: number | null
  sortOrder?: number | null
}

interface Note {
  _id: Id<'notes'>
  title: string
  sortOrder?: number | null
}

interface SectionGroupProps {
  sectionId?: Id<'sections'>
  sectionName?: string
  tasks: Task[]
  notes?: Note[]
  projectId?: Id<'projects'>
  showCompleted?: boolean
  hideCompletedSection?: boolean
  isAddingTask?: boolean
  onAddingTaskHandled?: () => void
}

export function SectionGroup({
  sectionId,
  sectionName,
  tasks,
  notes = [],
  projectId,
  showCompleted = false,
  hideCompletedSection = false,
  isAddingTask,
  onAddingTaskHandled,
}: SectionGroupProps) {
  const { selectedNoteId, setSelectedNoteId } = useTaskNavigation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(showCompleted)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(sectionName ?? '')
  const [isAddingTaskToSection, setIsAddingTaskToSection] = useState(false)
  const [optimisticTaskOrder, setOptimisticTaskOrder] = useState<Id<'tasks'>[] | null>(null)
  const [optimisticMixedOrder, setOptimisticMixedOrder] = useState<Array<{
    type: 'task' | 'note'
    id: string
  }> | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reorderMixed = useMutation(api.notes.reorderMixed)
  const updateSection = useMutation(api.sections.update)
  const removeSection = useMutation(api.sections.remove)

  // Make sections droppable for cross-project moves in folder view
  const droppableId = projectId
    ? sectionId
      ? `section::${projectId}::${sectionId}`
      : `unsectioned::${projectId}`
    : undefined

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: droppableId ?? 'disabled',
    disabled: !droppableId,
  })

  const basePendingTasks = tasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const pendingTasks = useMemo(() => {
    if (!optimisticTaskOrder) return basePendingTasks
    const byId = new Map(basePendingTasks.map((t) => [t._id, t]))
    return optimisticTaskOrder.map((id) => byId.get(id)).filter(Boolean) as typeof basePendingTasks
  }, [basePendingTasks, optimisticTaskOrder])

  const baseOrder = useMemo(() => basePendingTasks.map((t) => t._id), [basePendingTasks])

  useEffect(() => {
    if (
      optimisticTaskOrder &&
      optimisticTaskOrder.length === baseOrder.length &&
      optimisticTaskOrder.every((id, index) => id === baseOrder[index])
    ) {
      setOptimisticTaskOrder(null)
    }
  }, [optimisticTaskOrder, baseOrder])

  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const sortedNotes = notes.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  // Combined and sorted items for mixed ordering
  const combinedItems = useMemo(() => {
    if (optimisticMixedOrder) {
      return optimisticMixedOrder
    }
    const items: Array<{ type: 'task' | 'note'; id: string; sortOrder: number }> = [
      ...pendingTasks.map((t) => ({
        type: 'task' as const,
        id: t._id,
        sortOrder: t.sortOrder ?? 0,
      })),
      ...sortedNotes.map((n) => ({
        type: 'note' as const,
        id: n._id,
        sortOrder: n.sortOrder ?? 0,
      })),
    ]
    return items.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [pendingTasks, sortedNotes, optimisticMixedOrder])

  useEffect(() => {
    setEditedName(sectionName ?? '')
  }, [sectionName])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  // Listen to drag events from parent DndContext for mixed task/note reordering
  useDndMonitor({
    onDragEnd: async (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id) return

      const activeParsed = parseDragId(active.id as string)
      const overParsed = parseDragId(over.id as string)

      // Only handle task/note reordering within this section
      const isLocalReorder =
        (activeParsed?.type === 'task' || activeParsed?.type === 'note') &&
        (overParsed?.type === 'task' || overParsed?.type === 'note')

      if (!isLocalReorder) return

      const oldIndex = combinedItems.findIndex(
        (i) => createDragId(i.type, i.id) === (active.id as string)
      )
      const newIndex = combinedItems.findIndex(
        (i) => createDragId(i.type, i.id) === (over.id as string)
      )

      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove([...combinedItems], oldIndex, newIndex)
      const newOrder = reordered.map((i) => ({ type: i.type, id: i.id }))

      setOptimisticMixedOrder(newOrder)
      await reorderMixed({ items: newOrder })
      setOptimisticMixedOrder(null)
    },
  })

  const handleSave = async () => {
    if (sectionId && editedName.trim() && editedName !== sectionName) {
      await updateSection({ id: sectionId, name: editedName.trim() })
    } else {
      setEditedName(sectionName ?? '')
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditedName(sectionName ?? '')
      setIsEditing(false)
    }
  }

  const handleAddTask = () => {
    setShowMenu(false)
    setIsAddingTaskToSection(true)
  }

  const handleRename = () => {
    setShowMenu(false)
    setIsEditing(true)
  }

  const handleDelete = async () => {
    if (sectionId) {
      await removeSection({ id: sectionId })
    }
    setShowMenu(false)
  }

  return (
    <div ref={setDropRef} className={cn('mb-4', isOver && 'bg-primary/10 rounded-md')}>
      {sectionName && sectionId && (
        <div className="group flex items-center gap-1 px-3 py-1.5">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 flex-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={cn('h-4 w-4 transition-transform', !isCollapsed && 'rotate-90')}
            />
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none"
              />
            ) : (
              <span>{sectionName}</span>
            )}
          </button>

          <div className="relative shrink-0 w-6 h-6 flex items-center justify-center" ref={menuRef}>
            {pendingTasks.length > 0 && (
              <span className="text-xs text-muted-foreground group-hover:hidden">
                {pendingTasks.length}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hidden group-hover:flex"
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[120px]">
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                  onClick={handleAddTask}
                >
                  <Plus className="h-3 w-3" />
                  Add task
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                  onClick={handleRename}
                >
                  <Pencil className="h-3 w-3" />
                  Rename
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!isCollapsed && (
        <div className="space-y-0.5">
          <SortableContext
            items={combinedItems.map((i) => createDragId(i.type, i.id))}
            strategy={verticalListSortingStrategy}
          >
            {combinedItems.map((item) => {
              if (item.type === 'task') {
                const task = pendingTasks.find((t) => t._id === item.id)
                if (!task) return null
                return (
                  <DraggableTaskRow
                    key={task._id}
                    taskId={task._id}
                    title={task.title}
                    status={task.status}
                    priority={task.priority}
                    dueDate={task.dueDate}
                  />
                )
              } else {
                const note = sortedNotes.find((n) => n._id === item.id)
                if (!note) return null
                return (
                  <DraggableNoteRow
                    key={note._id}
                    noteId={note._id}
                    title={note.title}
                    isSelected={selectedNoteId === note._id}
                    onSelect={setSelectedNoteId}
                  />
                )
              }
            })}
          </SortableContext>

          <QuickAddTask
            projectId={projectId}
            sectionId={sectionId}
            autoOpen={isAddingTaskToSection || isAddingTask}
            onAutoOpenHandled={onAddingTaskHandled}
            hideButton={!!sectionId}
            onClose={() => setIsAddingTaskToSection(false)}
          />

          {completedTasks.length > 0 && !hideCompletedSection && (
            <div className="mt-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                className="flex items-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronRight
                  className={cn('h-3 w-3 transition-transform', showCompletedTasks && 'rotate-90')}
                />
                Completed ({completedTasks.length})
              </button>

              {showCompletedTasks && (
                <div className="mt-1 space-y-0.5">
                  {completedTasks.map((task) => (
                    <DraggableTaskRow
                      key={task._id}
                      taskId={task._id}
                      title={task.title}
                      status={task.status}
                      priority={task.priority}
                      dueDate={task.dueDate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
