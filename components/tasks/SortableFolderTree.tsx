'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DraggableFolderItem } from './DraggableFolderItem'
import { DraggableProjectItem } from './DraggableProjectItem'

export function SortableFolderTree() {
  const folders = useQuery(api.folders.list)
  const projects = useQuery(api.projects.list)
  const reorderFolders = useMutation(api.folders.reorder)
  const reorderProjects = useMutation(api.projects.reorder)

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

  if (folders === undefined || projects === undefined) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
  }

  const sortedFolders = folders.slice().sort((a, b) => a.sortOrder - b.sortOrder)

  // Projects without a folder (standalone projects)
  const standaloneProjects = projects
    .filter((p) => !p.folderId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (sortedFolders.length === 0 && standaloneProjects.length === 0) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">No folders or projects yet</div>
  }

  const handleFolderDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // Check if dragging a folder
      const isFolder = sortedFolders.some((f) => f._id === active.id)

      if (isFolder) {
        const oldIndex = sortedFolders.findIndex((f) => f._id === active.id)
        const newIndex = sortedFolders.findIndex((f) => f._id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = [...sortedFolders]
          const [removed] = reordered.splice(oldIndex, 1)
          reordered.splice(newIndex, 0, removed)

          await reorderFolders({ orderedIds: reordered.map((f) => f._id) })
        }
      }
    }
  }

  const handleStandaloneProjectDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = standaloneProjects.findIndex((p) => p._id === active.id)
      const newIndex = standaloneProjects.findIndex((p) => p._id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...standaloneProjects]
        const [removed] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, removed)

        await reorderProjects({ orderedIds: reordered.map((p) => p._id) })
      }
    }
  }

  return (
    <div className="space-y-0.5">
      {/* Folders */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleFolderDragEnd}
      >
        <SortableContext
          items={sortedFolders.map((f) => f._id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedFolders.map((folder) => (
            <DraggableFolderItem
              key={folder._id}
              folderId={folder._id}
              name={folder.name}
              color={folder.color}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Standalone Projects */}
      {standaloneProjects.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleStandaloneProjectDragEnd}
        >
          <SortableContext
            items={standaloneProjects.map((p) => p._id)}
            strategy={verticalListSortingStrategy}
          >
            {standaloneProjects.map((project) => (
              <DraggableProjectItem
                key={project._id}
                projectId={project._id}
                name={project.name}
                color={project.color}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
