'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Hash, GripVertical, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { createDragId } from '@/lib/drag-utils'
import { useUnifiedDrag } from './TasksView'
import { Button } from '@/components/ui/button'

interface DraggableProjectItemProps {
  projectId: Id<'projects'>
  name: string
  color?: string
}

export function DraggableProjectItem({ projectId, name, color }: DraggableProjectItemProps) {
  const { selection, setSelection, setSelectedTaskId, editingProjectId, setEditingProjectId } =
    useTaskNavigation()
  const { activeId, activeType } = useUnifiedDrag()
  const tasks = useQuery(api.tasks.listByProject, { projectId })

  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(name)

  // Start editing if this project was just created
  useEffect(() => {
    if (editingProjectId === projectId) {
      setIsEditing(true)
      setEditingProjectId(null)
    }
  }, [editingProjectId, projectId, setEditingProjectId])
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateProject = useMutation(api.projects.update)
  const removeProject = useMutation(api.projects.remove)

  useEffect(() => {
    setEditedName(name)
  }, [name])

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

  const handleSave = async () => {
    const finalName = editedName.trim() || 'New Project'
    if (finalName !== name) {
      await updateProject({ id: projectId, name: finalName })
    }
    setEditedName(finalName)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditedName(name)
      setIsEditing(false)
    }
  }

  const handleRename = () => {
    setShowMenu(false)
    setIsEditing(true)
  }

  const handleDelete = async () => {
    await removeProject({ id: projectId })
    setShowMenu(false)
  }

  // Sortable for project reordering
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({
    id: projectId,
    // Disable layout animations - we use database mutations which cause full re-renders
    animateLayoutChanges: () => false,
  })

  // Droppable for accepting task drops
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: createDragId('project', projectId),
  })

  // Keep item hidden and skip transforms while being dragged OR while overlay is still showing
  // This prevents the flash where both item and overlay are visible during the 50ms delay
  const isActive = activeId === projectId
  const shouldHide = isDragging || isActive

  const style = {
    transform: shouldHide ? undefined : CSS.Transform.toString(transform),
    transition: shouldHide || isSorting ? undefined : transition,
  }

  const isSelected = selection.type === 'project' && selection.projectId === projectId
  const pendingCount = tasks?.filter((t) => t.status === 'pending').length ?? 0
  const isDraggingTask = activeType === 'task'

  const handleClick = () => {
    setSelection({ type: 'project', projectId })
    setSelectedTaskId(null)
  }

  // Combine refs for both sortable and droppable
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 px-2 py-1.5 mt-0.5 rounded-md text-sm transition-colors',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground',
        shouldHide && 'opacity-0',
        isDraggingTask && 'bg-primary/5',
        isOver && 'bg-primary/15'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Hash className="h-3.5 w-3.5 shrink-0" style={color ? { color } : undefined} />
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-transparent border-b border-primary outline-none min-w-0"
          />
        </div>
      ) : (
        <button
          onClick={handleClick}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setIsEditing(true)
          }}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <Hash className="h-3.5 w-3.5 shrink-0" style={color ? { color } : undefined} />
          <span className="flex-1 text-left truncate">{name}</span>
        </button>
      )}

      <div className="relative shrink-0 w-6 h-6 flex items-center justify-center" ref={menuRef}>
        {pendingCount > 0 && (
          <span className="text-xs text-muted-foreground group-hover:hidden">{pendingCount}</span>
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
  )
}
