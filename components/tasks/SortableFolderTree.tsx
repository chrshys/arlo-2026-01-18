'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DraggableFolderItem } from './DraggableFolderItem'
import { DraggableProjectItem } from './DraggableProjectItem'
import { useState, useCallback, useMemo } from 'react'
import { Folder, Hash } from 'lucide-react'

type DragItemType = 'folder' | 'project' | null

export function SortableFolderTree() {
  const folders = useQuery(api.folders.list)
  const projects = useQuery(api.projects.list)
  const reorderFolders = useMutation(api.folders.reorder)
  const reorderProjects = useMutation(api.projects.reorder)
  const moveProjectToFolder = useMutation(api.projects.moveToFolder)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<DragItemType>(null)

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

  // Memoize sorted data
  const sortedFolders = useMemo(
    () => folders?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? [],
    [folders]
  )

  const standaloneProjects = useMemo(
    () => projects?.filter((p) => !p.folderId).sort((a, b) => a.sortOrder - b.sortOrder) ?? [],
    [projects]
  )

  // Custom collision detection that prefers folder drops for projects
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // If dragging a project, check for folder intersections first
      if (activeType === 'project') {
        const pointerCollisions = pointerWithin(args)
        if (pointerCollisions.length > 0) {
          // Prefer folder collisions
          const folderCollision = pointerCollisions.find((c) =>
            sortedFolders.some((f) => f._id === c.id)
          )
          if (folderCollision) {
            return [folderCollision]
          }
        }
      }
      // Fall back to closest center for sorting
      return rectIntersection(args)
    },
    [activeType, sortedFolders]
  )

  if (folders === undefined || projects === undefined) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
  }

  if (sortedFolders.length === 0 && standaloneProjects.length === 0) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">No folders or projects yet</div>
  }

  const folderIds = new Set(sortedFolders.map((f) => f._id))
  const allProjectIds = new Set(projects.map((p) => p._id))

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string
    setActiveId(id)

    if (folderIds.has(id as Id<'folders'>)) {
      setActiveType('folder')
    } else if (allProjectIds.has(id as Id<'projects'>)) {
      setActiveType('project')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveId(null)
    setActiveType(null)

    if (!over || active.id === over.id) return

    const activeIdStr = active.id as string
    const overIdStr = over.id as string

    // Check if dragging a project onto a folder
    if (allProjectIds.has(activeIdStr as Id<'projects'>)) {
      // Dropping onto a folder
      if (folderIds.has(overIdStr as Id<'folders'>)) {
        await moveProjectToFolder({
          id: activeIdStr as Id<'projects'>,
          folderId: overIdStr as Id<'folders'>,
        })
        return
      }

      // Reordering standalone projects
      const oldIndex = standaloneProjects.findIndex((p) => p._id === activeIdStr)
      const newIndex = standaloneProjects.findIndex((p) => p._id === overIdStr)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...standaloneProjects]
        const [removed] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, removed)
        await reorderProjects({ orderedIds: reordered.map((p) => p._id) })
      }
      return
    }

    // Reordering folders
    if (folderIds.has(activeIdStr as Id<'folders'>) && folderIds.has(overIdStr as Id<'folders'>)) {
      const oldIndex = sortedFolders.findIndex((f) => f._id === activeIdStr)
      const newIndex = sortedFolders.findIndex((f) => f._id === overIdStr)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...sortedFolders]
        const [removed] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, removed)
        await reorderFolders({ orderedIds: reordered.map((f) => f._id) })
      }
    }
  }

  // Find active item for overlay
  const activeFolder =
    activeType === 'folder' ? sortedFolders.find((f) => f._id === activeId) : null
  const activeProject = activeType === 'project' ? projects.find((p) => p._id === activeId) : null

  // All sortable items
  const allItems = [...sortedFolders.map((f) => f._id), ...standaloneProjects.map((p) => p._id)]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allItems} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          {/* Folders */}
          {sortedFolders.map((folder) => (
            <DraggableFolderItem
              key={folder._id}
              folderId={folder._id}
              name={folder.name}
              color={folder.color}
              isDropTarget={activeType === 'project'}
            />
          ))}

          {/* Standalone Projects */}
          {standaloneProjects.map((project) => (
            <DraggableProjectItem
              key={project._id}
              projectId={project._id}
              name={project.name}
              color={project.color}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeFolder && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-accent shadow-lg">
            <Folder
              className="h-3.5 w-3.5"
              style={activeFolder.color ? { color: activeFolder.color } : undefined}
            />
            <span>{activeFolder.name}</span>
          </div>
        )}
        {activeProject && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-accent shadow-lg">
            <Hash
              className="h-3.5 w-3.5"
              style={activeProject.color ? { color: activeProject.color } : undefined}
            />
            <span>{activeProject.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
