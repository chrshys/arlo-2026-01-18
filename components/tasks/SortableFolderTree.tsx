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
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DroppableFolderItem } from './DroppableFolderItem'
import { DraggableProjectItem } from './DraggableProjectItem'
import { useState, useCallback, useMemo } from 'react'
import { Folder, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

type DragItemType = 'folder' | 'project' | null

// Drop zone for removing projects from folders
function NoFolderDropZone({ isActive }: { isActive: boolean }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'no-folder-zone',
  })

  if (!isActive) return null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-2 px-3 py-2 rounded-md border-2 border-dashed text-xs text-center transition-colors',
        isOver
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-muted-foreground/30 text-muted-foreground'
      )}
    >
      Drop here to remove from folder
    </div>
  )
}

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

  // Projects grouped by folder
  const projectsByFolder = useMemo(() => {
    type Project = NonNullable<typeof projects>[number]
    const map = new Map<string, Project[]>()
    if (!projects) return map
    for (const project of projects) {
      if (project.folderId) {
        const existing = map.get(project.folderId) ?? []
        map.set(project.folderId, [...existing, project])
      }
    }
    // Sort projects within each folder
    for (const [folderId, folderProjects] of map) {
      map.set(
        folderId,
        folderProjects.sort((a, b) => a.sortOrder - b.sortOrder)
      )
    }
    return map
  }, [projects])

  const folderIds = useMemo(() => new Set(sortedFolders.map((f) => f._id)), [sortedFolders])
  const allProjectIds = useMemo(() => new Set(projects?.map((p) => p._id) ?? []), [projects])

  // Custom collision detection that prefers folder drops for projects
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // If dragging a project, check for folder intersections first
      if (activeType === 'project') {
        const pointerCollisions = pointerWithin(args)
        if (pointerCollisions.length > 0) {
          // Check for no-folder zone first
          const noFolderCollision = pointerCollisions.find((c) => c.id === 'no-folder-zone')
          if (noFolderCollision) {
            return [noFolderCollision]
          }
          // Then check for folder collisions
          const folderCollision = pointerCollisions.find((c) =>
            folderIds.has(c.id as Id<'folders'>)
          )
          if (folderCollision) {
            return [folderCollision]
          }
        }
      }
      // Fall back to rect intersection for sorting
      return rectIntersection(args)
    },
    [activeType, folderIds]
  )

  if (folders === undefined || projects === undefined) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
  }

  if (sortedFolders.length === 0 && standaloneProjects.length === 0) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">No folders or projects yet</div>
  }

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

    if (!over) return
    if (active.id === over.id) return

    const activeIdStr = active.id as string
    const overIdStr = over.id as string

    // Check if dragging a project
    if (allProjectIds.has(activeIdStr as Id<'projects'>)) {
      // Dropping onto no-folder zone - remove from folder
      if (overIdStr === 'no-folder-zone') {
        await moveProjectToFolder({
          id: activeIdStr as Id<'projects'>,
          folderId: undefined,
        })
        return
      }

      // Dropping onto a folder
      if (folderIds.has(overIdStr as Id<'folders'>)) {
        await moveProjectToFolder({
          id: activeIdStr as Id<'projects'>,
          folderId: overIdStr as Id<'folders'>,
        })
        return
      }

      // Dropping onto another standalone project - reorder
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
  const activeProject = activeType === 'project' ? projects?.find((p) => p._id === activeId) : null

  // Check if dragging a project that's in a folder
  const isDraggingFolderProject = activeProject?.folderId !== undefined

  // All top-level sortable items (folders + standalone projects)
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
          {/* Folders with their projects */}
          {sortedFolders.map((folder) => (
            <DroppableFolderItem
              key={folder._id}
              folderId={folder._id}
              name={folder.name}
              color={folder.color}
              projects={projectsByFolder.get(folder._id) ?? []}
              isDropTarget={activeType === 'project'}
              onReorderProjects={async (orderedIds) => {
                await reorderProjects({ orderedIds })
              }}
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

          {/* Drop zone to remove from folder */}
          <NoFolderDropZone isActive={isDraggingFolderProject} />
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
