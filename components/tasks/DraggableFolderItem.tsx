'use client'

import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, Folder, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DraggableProjectItem } from './DraggableProjectItem'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'

interface DraggableFolderItemProps {
  folderId: Id<'folders'>
  name: string
  color?: string
}

export function DraggableFolderItem({ folderId, name, color }: DraggableFolderItemProps) {
  const { expandedFolders, toggleFolder } = useTaskNavigation()
  const projects = useQuery(api.projects.listByFolder, { folderId })
  const reorderProjects = useMutation(api.projects.reorder)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm transition-colors',
          'hover:bg-accent/50',
          isDragging && 'opacity-50 bg-accent'
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
