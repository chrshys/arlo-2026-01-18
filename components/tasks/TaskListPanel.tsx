'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { TaskListHeader } from './TaskListHeader'
import { SectionGroup } from './SectionGroup'
import { QuickAddTask } from './QuickAddTask'
import { DraggableTaskRow } from './DraggableTaskRow'
import { NoteRow } from '@/components/notes/NoteRow'
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { createDragId, parseDragId } from '@/lib/drag-utils'

interface TaskListPanelProps {
  className?: string
}

export function TaskListPanel({ className }: TaskListPanelProps) {
  const { selection } = useTaskNavigation()
  const [isAddingSection, setIsAddingSection] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)

  // Fetch tasks based on selection
  const inboxTasks = useQuery(
    api.tasks.listByProject,
    selection.type === 'smart-list' && selection.list === 'inbox'
      ? { projectId: undefined }
      : 'skip'
  )

  const todayTasks = useQuery(
    api.tasks.listToday,
    selection.type === 'smart-list' && selection.list === 'today' ? {} : 'skip'
  )

  const next7Tasks = useQuery(
    api.tasks.listNext7Days,
    selection.type === 'smart-list' && selection.list === 'next7days' ? {} : 'skip'
  )

  const projectTasks = useQuery(
    api.tasks.listByProject,
    selection.type === 'project' ? { projectId: selection.projectId } : 'skip'
  )

  const sections = useQuery(
    api.sections.listByProject,
    selection.type === 'project' ? { projectId: selection.projectId } : 'skip'
  )

  // Fetch notes for inbox or project
  const inboxNotes = useQuery(
    api.notes.listByProject,
    selection.type === 'smart-list' && selection.list === 'inbox'
      ? { projectId: undefined }
      : 'skip'
  )

  const projectNotes = useQuery(
    api.notes.listByProject,
    selection.type === 'project' ? { projectId: selection.projectId } : 'skip'
  )

  // Determine which tasks to show
  let tasks: typeof inboxTasks = undefined
  let isSmartList = false

  let notes: typeof inboxNotes = undefined

  if (selection.type === 'smart-list') {
    isSmartList = true
    switch (selection.list) {
      case 'inbox':
        tasks = inboxTasks
        notes = inboxNotes
        break
      case 'today':
        tasks = todayTasks
        break
      case 'next7days':
        tasks = next7Tasks
        break
    }
  } else {
    tasks = projectTasks
    notes = projectNotes
  }

  const isLoading = tasks === undefined

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <TaskListHeader
        onAddSection={() => setIsAddingSection(true)}
        onAddTask={() => setIsAddingTask(true)}
      />

      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        ) : isSmartList ? (
          // Smart list view - flat list of tasks
          <SmartListView
            tasks={tasks ?? []}
            notes={notes ?? []}
            projectId={
              selection.type === 'smart-list' && selection.list === 'inbox' ? undefined : undefined
            }
            isAddingTask={isAddingTask}
            onAddingTaskHandled={() => setIsAddingTask(false)}
          />
        ) : (
          // Project view - grouped by sections
          <ProjectView
            tasks={tasks ?? []}
            notes={notes ?? []}
            sections={sections ?? []}
            projectId={selection.type === 'project' ? selection.projectId : undefined}
            isAddingSection={isAddingSection}
            onAddSectionDone={() => setIsAddingSection(false)}
            isAddingTask={isAddingTask}
            onAddingTaskHandled={() => setIsAddingTask(false)}
          />
        )}
      </div>
    </div>
  )
}

interface TaskData {
  _id: Id<'tasks'>
  title: string
  status: 'pending' | 'completed'
  priority?: 'none' | 'low' | 'medium' | 'high' | null
  dueDate?: number | null
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface NoteData {
  _id: Id<'notes'>
  title: string
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface SmartListViewProps {
  tasks: TaskData[]
  notes: NoteData[]
  projectId?: Id<'projects'>
  isAddingTask?: boolean
  onAddingTaskHandled?: () => void
}

function SmartListView({ tasks, notes, isAddingTask, onAddingTaskHandled }: SmartListViewProps) {
  const { selectedNoteId, setSelectedNoteId } = useTaskNavigation()
  const reorderTasks = useMutation(api.tasks.reorder)

  const sortedNotes = notes.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const pendingTasks = tasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  // Listen to drag events from parent DndContext for task reordering
  useDndMonitor({
    onDragEnd: async (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id) return

      const activeParsed = parseDragId(active.id as string)
      const overParsed = parseDragId(over.id as string)

      // Only handle task-to-task reordering
      if (activeParsed?.type === 'task' && overParsed?.type === 'task') {
        const oldIndex = pendingTasks.findIndex((t) => t._id === activeParsed.id)
        const newIndex = pendingTasks.findIndex((t) => t._id === overParsed.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = [...pendingTasks]
          const [removed] = reordered.splice(oldIndex, 1)
          reordered.splice(newIndex, 0, removed)

          await reorderTasks({ orderedIds: reordered.map((t) => t._id) })
        }
      }
    },
  })

  if (tasks.length === 0 && notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <p>No tasks or notes</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {/* Notes */}
      {sortedNotes.map((note) => (
        <NoteRow
          key={note._id}
          noteId={note._id}
          title={note.title}
          isSelected={selectedNoteId === note._id}
          onSelect={setSelectedNoteId}
        />
      ))}

      <SortableContext
        items={pendingTasks.map((t) => createDragId('task', t._id))}
        strategy={verticalListSortingStrategy}
      >
        {pendingTasks.map((task) => (
          <DraggableTaskRow
            key={task._id}
            taskId={task._id}
            title={task.title}
            status={task.status}
            priority={task.priority}
            dueDate={task.dueDate}
          />
        ))}
      </SortableContext>

      <QuickAddTask autoOpen={isAddingTask} onAutoOpenHandled={onAddingTaskHandled} />

      {completedTasks.length > 0 && (
        <div className="mt-4 pt-2 border-t border-border">
          <p className="px-3 py-1 text-xs text-muted-foreground mb-1">
            Completed ({completedTasks.length})
          </p>
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
  )
}

interface ProjectViewProps {
  tasks: TaskData[]
  notes: NoteData[]
  sections: Array<{
    _id: Id<'sections'>
    name: string
    sortOrder: number
  }>
  projectId?: Id<'projects'>
  isAddingSection?: boolean
  onAddSectionDone?: () => void
  isAddingTask?: boolean
  onAddingTaskHandled?: () => void
}

function ProjectView({
  tasks,
  notes,
  sections,
  projectId,
  isAddingSection,
  onAddSectionDone,
  isAddingTask,
  onAddingTaskHandled,
}: ProjectViewProps) {
  const [sectionName, setSectionName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const createSection = useMutation(api.sections.create)

  // Tasks and notes without a section
  const unsectionedTasks = tasks.filter((t) => !t.sectionId)
  const unsectionedNotes = notes.filter((n) => !n.sectionId)

  // Group tasks by section
  const sortedSections = sections.slice().sort((a, b) => a.sortOrder - b.sortOrder)

  useEffect(() => {
    if (isAddingSection && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAddingSection])

  const handleSubmit = async () => {
    const trimmedName = sectionName.trim()
    if (trimmedName && projectId) {
      await createSection({ name: trimmedName, projectId })
    }
    setSectionName('')
    onAddSectionDone?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setSectionName('')
      onAddSectionDone?.()
    }
  }

  return (
    <div>
      {/* Unsectioned tasks and notes */}
      {(unsectionedTasks.length > 0 || unsectionedNotes.length > 0 || sections.length === 0) && (
        <SectionGroup
          tasks={unsectionedTasks}
          notes={unsectionedNotes}
          projectId={projectId}
          isAddingTask={isAddingTask}
          onAddingTaskHandled={onAddingTaskHandled}
        />
      )}

      {/* Sectioned tasks and notes */}
      {sortedSections.map((section) => {
        const sectionTasks = tasks.filter((t) => t.sectionId === section._id)
        const sectionNotes = notes.filter((n) => n.sectionId === section._id)
        return (
          <SectionGroup
            key={section._id}
            sectionId={section._id}
            sectionName={section.name}
            tasks={sectionTasks}
            notes={sectionNotes}
            projectId={projectId}
          />
        )
      })}

      {/* Add section input */}
      {isAddingSection && (
        <div className="px-3 py-2 mt-2">
          <input
            ref={inputRef}
            type="text"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            placeholder="Section name"
            className="w-full text-sm font-medium bg-transparent border-b border-primary outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
    </div>
  )
}
