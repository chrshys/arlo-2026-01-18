'use client'

import { useDroppable, useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DroppableFolderItem } from './DroppableFolderItem'
import { DraggableProjectItem } from './DraggableProjectItem'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useUnifiedDrag } from './TasksView'

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

  // Get drag state from unified context
  const { activeId, activeType } = useUnifiedDrag()

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

  // Sortable items depend on what's being dragged:
  // - Dragging folder: only folders are sortable (so folders reorder among themselves)
  // - Dragging project: only standalone projects are sortable (folders stay fixed as drop targets)
  // - Not dragging: all items (default state)
  const sortableItems = useMemo(() => {
    if (activeType === 'folder') {
      return sortedFolders.map((f) => f._id)
    }
    if (activeType === 'project') {
      return standaloneProjects.map((p) => p._id)
    }
    return [...sortedFolders.map((f) => f._id), ...standaloneProjects.map((p) => p._id)]
  }, [activeType, sortedFolders, standaloneProjects])

  // Listen to drag events from parent DndContext for reordering
  useDndMonitor({
    onDragEnd: async (event: DragEndEvent) => {
      const { active, over } = event

      if (!over) return
      if (active.id === over.id) return

      const activeIdStr = active.id as string
      const overIdStr = over.id as string

      // Handle project reordering (standalone projects only)
      if (allProjectIds.has(activeIdStr as Id<'projects'>)) {
        // Only handle reordering among standalone projects here
        // Folder drops are handled by parent's handleDragEnd
        if (allProjectIds.has(overIdStr as Id<'projects'>)) {
          const oldIndex = standaloneProjects.findIndex((p) => p._id === activeIdStr)
          const newIndex = standaloneProjects.findIndex((p) => p._id === overIdStr)

          if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = [...standaloneProjects]
            const [removed] = reordered.splice(oldIndex, 1)
            reordered.splice(newIndex, 0, removed)
            await reorderProjects({ orderedIds: reordered.map((p) => p._id) })
          }
        }
        return
      }

      // Handle folder reordering
      if (
        folderIds.has(activeIdStr as Id<'folders'>) &&
        folderIds.has(overIdStr as Id<'folders'>)
      ) {
        const oldIndex = sortedFolders.findIndex((f) => f._id === activeIdStr)
        const newIndex = sortedFolders.findIndex((f) => f._id === overIdStr)

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = [...sortedFolders]
          const [removed] = reordered.splice(oldIndex, 1)
          reordered.splice(newIndex, 0, removed)
          await reorderFolders({ orderedIds: reordered.map((f) => f._id) })
        }
      }
    },
  })

  if (folders === undefined || projects === undefined) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
  }

  if (sortedFolders.length === 0 && standaloneProjects.length === 0) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">No folders or projects yet</div>
  }

  // Check if dragging a project that's in a folder
  const activeProject = activeType === 'project' ? projects?.find((p) => p._id === activeId) : null
  const isDraggingFolderProject = activeProject?.folderId !== undefined

  return (
    <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
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
  )
}
