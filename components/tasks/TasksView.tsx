'use client'

import { TasksSidebar } from './TasksSidebar'
import { TaskListPanel } from './TaskListPanel'
import { TaskDetailPanel } from './TaskDetailPanel'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { TaskNavigationProvider } from '@/hooks/use-task-navigation'
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
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useState, useCallback, createContext, useContext, useMemo, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { parseDragId, type DragItemType } from '@/lib/drag-utils'
import { Circle, FileText, Folder, Hash } from 'lucide-react'
import { PANEL_SIZES } from '@/types/panel-layout'

// Shared storage key - panel sizes sync across views since IDs match
const STORAGE_KEY = 'arlo-panel-sizes'

type PanelSizes = Record<string, number>

function loadSizes(): PanelSizes | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // Ignore parse errors
  }
  return undefined
}

function saveSizes(sizes: PanelSizes): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
  } catch {
    // Ignore storage errors
  }
}

// Context to share drag state with child components
interface UnifiedDragContextValue {
  activeId: string | null
  activeType: DragItemType | null
}

const UnifiedDragContext = createContext<UnifiedDragContextValue>({
  activeId: null,
  activeType: null,
})

export function useUnifiedDrag() {
  return useContext(UnifiedDragContext)
}

export function TasksView() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<DragItemType | null>(null)
  const [savedSizes, setSavedSizes] = useState<PanelSizes | undefined>(undefined)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setSavedSizes(loadSizes())
    setIsHydrated(true)
  }, [])

  const handleLayoutChanged = useCallback((newLayout: PanelSizes) => {
    saveSizes(newLayout)
    setSavedSizes(newLayout)
  }, [])

  // Mutations for drag operations
  const moveTaskToProject = useMutation(api.tasks.moveToProject)
  const setDueToday = useMutation(api.tasks.setDueToday)
  const moveProjectToFolder = useMutation(api.projects.moveToFolder)
  const moveNoteToSection = useMutation(api.notes.moveToSection)
  const moveNoteToProject = useMutation(api.notes.moveToProject)

  // Get data for drag overlay and collision detection
  const projects = useQuery(api.projects.list)
  const folders = useQuery(api.folders.list)
  const tasks = useQuery(api.tasks.list)
  const notes = useQuery(api.notes.list)

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

  // Build lookup sets for collision detection
  const folderIds = useMemo(() => new Set(folders?.map((f) => f._id) ?? []), [folders])
  const projectIds = useMemo(() => new Set(projects?.map((p) => p._id) ?? []), [projects])

  // Custom collision detection
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerCollisions = pointerWithin(args)

      if (activeType === 'task') {
        // For tasks, prioritize drop targets (smart lists, projects, sections)
        if (pointerCollisions.length > 0) {
          // Check for smart list drops first
          const smartListCollision = pointerCollisions.find(
            (c) => c.id === 'smart-list::inbox' || c.id === 'smart-list::today'
          )
          if (smartListCollision) {
            return [smartListCollision]
          }

          // Check for section drops (for folder view cross-project moves)
          const sectionCollision = pointerCollisions.find((c) => {
            const id = c.id as string
            return id.startsWith('section::') || id.startsWith('unsectioned::')
          })
          if (sectionCollision) {
            return [sectionCollision]
          }

          // Then check for project drops
          const projectCollision = pointerCollisions.find((c) => {
            const parsed = parseDragId(c.id as string)
            return parsed?.type === 'project'
          })
          if (projectCollision) {
            return [projectCollision]
          }
        }
        // Fall back to rect intersection for task reordering
        return rectIntersection(args)
      }

      if (activeType === 'note') {
        // For notes, prioritize sections and projects only (not smart lists)
        if (pointerCollisions.length > 0) {
          // Check for section drops (for cross-project moves)
          const sectionCollision = pointerCollisions.find((c) => {
            const id = c.id as string
            return id.startsWith('section::') || id.startsWith('unsectioned::')
          })
          if (sectionCollision) {
            return [sectionCollision]
          }

          // Then check for project drops
          const projectCollision = pointerCollisions.find((c) => {
            const parsed = parseDragId(c.id as string)
            return parsed?.type === 'project'
          })
          if (projectCollision) {
            return [projectCollision]
          }
        }
        // Fall back to rect intersection for note reordering
        return rectIntersection(args)
      }

      if (activeType === 'project') {
        // For projects, check for folder drops first
        if (pointerCollisions.length > 0) {
          const noFolderCollision = pointerCollisions.find((c) => c.id === 'no-folder-zone')
          if (noFolderCollision) {
            return [noFolderCollision]
          }

          const folderCollision = pointerCollisions.find((c) =>
            folderIds.has(c.id as Id<'folders'>)
          )
          if (folderCollision) {
            return [folderCollision]
          }
        }
        return rectIntersection(args)
      }

      // Default for folders
      return rectIntersection(args)
    },
    [activeType, folderIds]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string

    // Parse typed ID
    const parsed = parseDragId(id)
    if (parsed) {
      setActiveId(parsed.id)
      setActiveType(parsed.type)
      return
    }

    // Legacy: check if it's a folder or project ID directly (from SortableFolderTree)
    if (folderIds.has(id as Id<'folders'>)) {
      setActiveId(id)
      setActiveType('folder')
    } else if (projectIds.has(id as Id<'projects'>)) {
      setActiveId(id)
      setActiveType('project')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    // Delay clearing active state to avoid flicker - let the reorder mutation
    // trigger a re-render first, then hide the overlay
    setTimeout(() => {
      setActiveId(null)
      setActiveType(null)
    }, 50)

    if (!over) return
    if (active.id === over.id) return

    const activeIdStr = active.id as string
    const overIdStr = over.id as string

    // Parse the active item
    const activeParsed = parseDragId(activeIdStr)

    // Handle task drops
    if (activeParsed?.type === 'task') {
      const taskId = activeParsed.id as Id<'tasks'>

      // Dropping on Inbox
      if (overIdStr === 'smart-list::inbox') {
        await moveTaskToProject({ id: taskId, projectId: undefined })
        return
      }

      // Dropping on Today
      if (overIdStr === 'smart-list::today') {
        await setDueToday({ id: taskId })
        return
      }

      // Handle section drops (for folder view cross-project moves)
      if (overIdStr.startsWith('section::')) {
        const [, projectId, sectionId] = overIdStr.split('::')
        await moveTaskToProject({
          id: taskId,
          projectId: projectId as Id<'projects'>,
          sectionId: sectionId as Id<'sections'>,
        })
        return
      }

      if (overIdStr.startsWith('unsectioned::')) {
        const [, projectId] = overIdStr.split('::')
        await moveTaskToProject({
          id: taskId,
          projectId: projectId as Id<'projects'>,
          sectionId: undefined,
        })
        return
      }

      // Dropping on a project
      const overParsed = parseDragId(overIdStr)
      if (overParsed?.type === 'project') {
        await moveTaskToProject({
          id: taskId,
          projectId: overParsed.id as Id<'projects'>,
        })
        return
      }

      // Task reordering (dropping on another task)
      if (overParsed?.type === 'task') {
        // Find the tasks in the current view and reorder
        // This is handled by the SortableContext in the child components
        // The reorder mutation is called there
        return
      }

      return
    }

    // Handle note drops
    if (activeParsed?.type === 'note') {
      const noteId = activeParsed.id as Id<'notes'>

      // Handle section drops (cross-project or cross-section moves)
      if (overIdStr.startsWith('section::')) {
        const [, projectId, sectionId] = overIdStr.split('::')
        await moveNoteToSection({
          noteId,
          projectId: projectId as Id<'projects'>,
          sectionId: sectionId as Id<'sections'>,
        })
        return
      }

      if (overIdStr.startsWith('unsectioned::')) {
        const [, projectId] = overIdStr.split('::')
        await moveNoteToSection({
          noteId,
          projectId: projectId as Id<'projects'>,
          sectionId: undefined,
        })
        return
      }

      // Dropping on a project in sidebar
      const overParsed = parseDragId(overIdStr)
      if (overParsed?.type === 'project') {
        await moveNoteToProject({
          id: noteId,
          projectId: overParsed.id as Id<'projects'>,
        })
        return
      }

      // Note reordering (dropping on another note or task) - handled by SectionGroup
      return
    }

    // Handle project drops (existing logic from SortableFolderTree)
    if (activeParsed?.type === 'project' || projectIds.has(activeIdStr as Id<'projects'>)) {
      const projectId = (activeParsed?.id ?? activeIdStr) as Id<'projects'>

      // Dropping onto no-folder zone
      if (overIdStr === 'no-folder-zone') {
        await moveProjectToFolder({ id: projectId, folderId: undefined })
        return
      }

      // Dropping onto a folder
      if (folderIds.has(overIdStr as Id<'folders'>)) {
        await moveProjectToFolder({
          id: projectId,
          folderId: overIdStr as Id<'folders'>,
        })
        return
      }

      // Project reordering - handled by SortableFolderTree
      return
    }

    // Handle folder reordering - handled by SortableFolderTree
  }

  // Find active items for overlay
  const activeTask = activeType === 'task' ? tasks?.find((t) => t._id === activeId) : null
  const activeNote = activeType === 'note' ? notes?.find((n) => n._id === activeId) : null
  const activeProject = activeType === 'project' ? projects?.find((p) => p._id === activeId) : null
  const activeFolder = activeType === 'folder' ? folders?.find((f) => f._id === activeId) : null

  // Wait for hydration to avoid layout shift
  if (!isHydrated) {
    return <div className="h-full w-full bg-background" />
  }

  return (
    <TaskNavigationProvider>
      <UnifiedDragContext.Provider value={{ activeId, activeType }}>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Group
            id="panels"
            orientation="horizontal"
            className="h-full w-full"
            defaultLayout={savedSizes}
            onLayoutChanged={handleLayoutChanged}
          >
            <Panel
              id="sidebar"
              defaultSize={PANEL_SIZES.sidebar.default}
              minSize={PANEL_SIZES.sidebar.min}
              maxSize={PANEL_SIZES.sidebar.max}
            >
              <div className="h-full w-full bg-muted/30 border-r border-border">
                <TasksSidebar />
              </div>
            </Panel>
            <Separator className="w-1 bg-border hover:bg-primary/50 cursor-col-resize outline-none" />
            <Panel id="main" minSize={PANEL_SIZES.main.min}>
              <div className="h-full w-full bg-background">
                <TaskListPanel />
              </div>
            </Panel>
            <Separator className="w-1 bg-border hover:bg-primary/50 cursor-col-resize outline-none" />
            <Panel
              id="detail"
              defaultSize={PANEL_SIZES.detail.default}
              minSize={PANEL_SIZES.detail.min}
              maxSize={PANEL_SIZES.detail.max}
            >
              <div className="h-full w-full bg-background border-l border-border">
                <TaskDetailPanel />
              </div>
            </Panel>
          </Group>

          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-accent shadow-lg">
                <Circle className="h-4 w-4 text-muted-foreground" />
                <span className="truncate max-w-[200px]">{activeTask.title}</span>
              </div>
            )}
            {activeNote && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-accent shadow-lg">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="truncate max-w-[200px]">{activeNote.title}</span>
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
            {activeFolder && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-accent shadow-lg">
                <Folder
                  className="h-3.5 w-3.5"
                  style={activeFolder.color ? { color: activeFolder.color } : undefined}
                />
                <span>{activeFolder.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </UnifiedDragContext.Provider>
    </TaskNavigationProvider>
  )
}
