'use client'

import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, Folder, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { Id } from '@/convex/_generated/dataModel'
import { DraggableProjectItem } from './DraggableProjectItem'

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
  onReorderProjects: (orderedIds: Id<'projects'>[]) => Promise<void>
}

export function DroppableFolderItem({
  folderId,
  name,
  color,
  projects,
  isDropTarget = false,
}: DroppableFolderItemProps) {
  const { expandedFolders, toggleFolder } = useTaskNavigation()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderId,
  })

  // Make this folder a drop target for projects
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: folderId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isExpanded = expandedFolders.has(folderId)

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
          isDragging && 'opacity-50 bg-accent',
          isDropTarget && isOver && 'ring-2 ring-primary bg-primary/10'
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
        </div>

        <button
          onClick={() => toggleFolder(folderId)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isExpanded && 'rotate-90')}
          />
          <Folder className="h-3.5 w-3.5 shrink-0" style={color ? { color } : undefined} />
          <span className="flex-1 text-left truncate font-medium">{name}</span>
        </button>
      </div>

      {isExpanded && projects.length > 0 && (
        <div className="ml-4">
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
