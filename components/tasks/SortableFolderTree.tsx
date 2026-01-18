'use client'

import { useDroppable, useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id, Doc } from '@/convex/_generated/dataModel'
import { DroppableFolderItem } from './DroppableFolderItem'
import { DraggableProjectItem } from './DraggableProjectItem'
import { useMemo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useUnifiedDrag } from './TasksView'
import { useTaskNavigation } from '@/hooks/use-task-navigation'

type SidebarItem =
  | { type: 'folder'; id: Id<'folders'>; sortOrder: number; data: Doc<'folders'> }
  | { type: 'project'; id: Id<'projects'>; sortOrder: number; data: Doc<'projects'> }

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
  const reorderProjects = useMutation(api.projects.reorder)
  const reorderSidebar = useMutation(api.sidebar.reorder)
  const [optimisticSidebarOrder, setOptimisticSidebarOrder] = useState<
    { id: string; type: 'folder' | 'project' }[] | null
  >(null)

  // Get drag state from unified context
  const { activeId, activeType } = useUnifiedDrag()
  const { selection, setSelection } = useTaskNavigation()

  // Build unified sidebar items (folders + standalone projects) sorted by sortOrder
  const baseSidebarItems = useMemo(() => {
    const items: SidebarItem[] = []
    if (folders) {
      for (const folder of folders) {
        items.push({ type: 'folder', id: folder._id, sortOrder: folder.sortOrder, data: folder })
      }
    }
    if (projects) {
      for (const project of projects) {
        if (!project.folderId) {
          items.push({
            type: 'project',
            id: project._id,
            sortOrder: project.sortOrder,
            data: project,
          })
        }
      }
    }
    return items.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [folders, projects])

  // Apply optimistic ordering if present
  const sidebarItems = useMemo(() => {
    if (!optimisticSidebarOrder) return baseSidebarItems
    const byId = new Map(baseSidebarItems.map((item) => [item.id as string, item]))
    return optimisticSidebarOrder.map((o) => byId.get(o.id)).filter(Boolean) as SidebarItem[]
  }, [baseSidebarItems, optimisticSidebarOrder])

  // Projects grouped by folder (for projects inside folders, not sidebar items)
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

  const allProjectIds = useMemo(() => new Set(projects?.map((p) => p._id) ?? []), [projects])

  // Reset optimistic order when server data matches
  const baseSidebarOrderKey = useMemo(
    () => baseSidebarItems.map((item) => `${item.type}:${item.id}`).join(','),
    [baseSidebarItems]
  )

  useEffect(() => {
    if (optimisticSidebarOrder) {
      const optimisticKey = optimisticSidebarOrder.map((o) => `${o.type}:${o.id}`).join(',')
      if (optimisticKey === baseSidebarOrderKey) {
        setOptimisticSidebarOrder(null)
      }
    }
  }, [optimisticSidebarOrder, baseSidebarOrderKey])

  // All sidebar items are sortable in a unified list
  // This enables dragging folders and standalone projects to any position
  const sortableItems = useMemo(() => sidebarItems.map((item) => item.id), [sidebarItems])

  // Listen to drag events from parent DndContext for reordering
  useDndMonitor({
    onDragEnd: async (event: DragEndEvent) => {
      const { active, over } = event

      if (!over) return
      if (active.id === over.id) return

      const activeIdStr = active.id as string
      const overIdStr = over.id as string

      // Check if this is a sidebar reordering (folder or standalone project dragged onto another sidebar item)
      const activeItem = sidebarItems.find((item) => item.id === activeIdStr)
      const overItem = sidebarItems.find((item) => item.id === overIdStr)

      // If both items are sidebar items, handle unified reordering
      if (activeItem && overItem) {
        const oldIndex = sidebarItems.findIndex((item) => item.id === activeIdStr)
        const newIndex = sidebarItems.findIndex((item) => item.id === overIdStr)

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = [...sidebarItems]
          const [removed] = reordered.splice(oldIndex, 1)
          reordered.splice(newIndex, 0, removed)

          const newOrder = reordered.map((item) => ({ id: item.id, type: item.type }))
          setOptimisticSidebarOrder(newOrder)
          await reorderSidebar({ orderedItems: newOrder })
        }
        return
      }

      // Handle in-folder project reordering (project dragged onto another project in the same folder)
      // This is separate from sidebar reordering
      if (allProjectIds.has(activeIdStr as Id<'projects'>)) {
        const activeProject = projects?.find((p) => p._id === activeIdStr)
        const overProject = projects?.find((p) => p._id === overIdStr)

        // Both projects in the same folder - reorder within folder
        if (activeProject?.folderId && activeProject.folderId === overProject?.folderId) {
          const folderProjects = projectsByFolder.get(activeProject.folderId) ?? []
          const oldIndex = folderProjects.findIndex((p) => p._id === activeIdStr)
          const newIndex = folderProjects.findIndex((p) => p._id === overIdStr)

          if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = [...folderProjects]
            const [removed] = reordered.splice(oldIndex, 1)
            reordered.splice(newIndex, 0, removed)
            await reorderProjects({ orderedIds: reordered.map((p) => p._id) })
          }
        }
      }
    },
  })

  if (folders === undefined || projects === undefined) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
  }

  if (sidebarItems.length === 0) {
    return <div className="px-3 py-2 text-sm text-muted-foreground">No folders or projects yet</div>
  }

  // Check if dragging a project that's in a folder
  const activeProject = activeType === 'project' ? projects?.find((p) => p._id === activeId) : null
  const isDraggingFolderProject = activeProject?.folderId !== undefined

  return (
    <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
      <div className="space-y-0.5">
        {/* Render folders and standalone projects in unified order */}
        {sidebarItems.map((item) => {
          if (item.type === 'folder') {
            const folder = item.data
            return (
              <DroppableFolderItem
                key={folder._id}
                folderId={folder._id}
                name={folder.name}
                color={folder.color}
                projects={projectsByFolder.get(folder._id) ?? []}
                isDropTarget={activeType === 'project'}
                isSelected={selection.type === 'folder' && selection.folderId === folder._id}
                onSelect={(folderId) => setSelection({ type: 'folder', folderId })}
                onReorderProjects={async (orderedIds) => {
                  await reorderProjects({ orderedIds })
                }}
              />
            )
          } else {
            const project = item.data
            return (
              <DraggableProjectItem
                key={project._id}
                projectId={project._id}
                name={project.name}
                color={project.color}
              />
            )
          }
        })}

        {/* Drop zone to remove from folder */}
        <NoFolderDropZone isActive={isDraggingFolderProject} />
      </div>
    </SortableContext>
  )
}
