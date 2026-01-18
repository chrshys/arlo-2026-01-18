'use client'

import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useUnifiedDrag } from './TasksView'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DraggableProjectItem } from './DraggableProjectItem'

interface DraggableFolderItemProps {
  folderId: Id<'folders'>
  name: string
  color?: string
  isDropTarget?: boolean
}

export function DraggableFolderItem({
  folderId,
  name,
  color: _color,
  isDropTarget = false,
}: DraggableFolderItemProps) {
  const { expandedFolders, toggleFolder } = useTaskNavigation()
  const { activeId } = useUnifiedDrag()
  const projects = useQuery(api.projects.listByFolder, { folderId })
  const reorderProjects = useMutation(api.projects.reorder)

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const isExpanded = expandedFolders.has(folderId)
  const sortedProjects = projects?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? []

  const handleProjectDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sortedProjects.findIndex((p) => p._id === active.id)
      const newIndex = sortedProjects.findIndex((p) => p._id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...sortedProjects]
        const [removed] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, removed)

        await reorderProjects({ orderedIds: reordered.map((p) => p._id) })
      }
    }
  }

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
          <span className="flex-1 text-left truncate font-medium">{name}</span>
        </button>
      </div>

      {isExpanded && sortedProjects.length > 0 && (
        <div className="ml-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleProjectDragEnd}
          >
            <SortableContext
              items={sortedProjects.map((p) => p._id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedProjects.map((project) => (
                <DraggableProjectItem
                  key={project._id}
                  projectId={project._id}
                  name={project.name}
                  color={project.color}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}
