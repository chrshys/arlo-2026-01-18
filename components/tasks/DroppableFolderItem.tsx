'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DraggableProjectItem } from './DraggableProjectItem'
import { useUnifiedDrag } from './TasksView'
import { Button } from '@/components/ui/button'

interface Project {
  _id: Id<'projects'>
  name: string
  color?: string
  sortOrder: number
}

interface DroppableFolderItemProps {
  folderId: Id<'folders'>
  name: string
  color?: string
  projects: Project[]
  isDropTarget?: boolean
  isSelected?: boolean
  onSelect?: (folderId: Id<'folders'>) => void
  onReorderProjects: (orderedIds: Id<'projects'>[]) => Promise<void>
}

export function DroppableFolderItem({
  folderId,
  name,
  color: _color,
  projects,
  isDropTarget = false,
  isSelected = false,
  onSelect,
}: DroppableFolderItemProps) {
  const { expandedFolders, toggleFolder, expandFolder, editingFolderId, setEditingFolderId } =
    useTaskNavigation()
  const { activeId, activeType } = useUnifiedDrag()

  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(name)

  // Start editing if this folder was just created
  useEffect(() => {
    if (editingFolderId === folderId) {
      setIsEditing(true)
      setEditingFolderId(null)
    }
  }, [editingFolderId, folderId, setEditingFolderId])
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateFolder = useMutation(api.folders.update)
  const removeFolder = useMutation(api.folders.remove)

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
    const finalName = editedName.trim() || 'New Folder'
    if (finalName !== name) {
      await updateFolder({ id: folderId, name: finalName })
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
    await removeFolder({ id: folderId })
    setShowMenu(false)
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } =
    useSortable({
      id: folderId,
      // Disable layout animations - we use database mutations which cause full re-renders
      animateLayoutChanges: () => false,
    })

  // Make this folder a drop target for projects
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: folderId,
  })

  // Keep item hidden and skip transforms while being dragged OR while overlay is still showing
  // This prevents the flash where both item and overlay are visible during the 50ms delay
  const isActive = activeId === folderId
  const shouldHide = isDragging || isActive

  const style = {
    transform: shouldHide ? undefined : CSS.Transform.toString(transform),
    transition: shouldHide || isSorting ? undefined : transition,
  }

  const isExpanded = expandedFolders.has(folderId)

  // Auto-expand folder when dragging a task over it (if it has projects)
  useEffect(() => {
    if (isOver && activeType === 'task' && projects.length > 0 && !isExpanded) {
      const timeout = setTimeout(() => {
        expandFolder(folderId)
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [isOver, activeType, projects.length, isExpanded, expandFolder, folderId])

  // Combine refs for both sortable and droppable
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    setDropRef(node)
  }

  return (
    <div ref={combinedRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm transition-colors',
          'hover:bg-accent/50',
          shouldHide && 'opacity-0',
          isDropTarget && isOver && 'bg-primary/15',
          isSelected && 'bg-accent'
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
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isExpanded && 'rotate-90')}
            />
            <input
              ref={inputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none min-w-0"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Chevron - toggle expand/collapse */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleFolder(folderId)
              }}
              className="shrink-0 p-0.5 hover:bg-accent rounded"
            >
              <ChevronRight
                className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-90')}
              />
            </button>

            {/* Name - select folder */}
            <button
              onClick={() => onSelect?.(folderId)}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <span className="flex-1 text-left truncate font-medium">{name}</span>
            </button>
          </div>
        )}

        <div className="relative shrink-0" ref={menuRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
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

      {isExpanded && projects.length > 0 && (
        <div className="ml-[22px]">
          {projects.map((project) => (
            <DraggableProjectItem
              key={project._id}
              projectId={project._id}
              name={project.name}
              color={project.color}
            />
          ))}
        </div>
      )}
    </div>
  )
}
