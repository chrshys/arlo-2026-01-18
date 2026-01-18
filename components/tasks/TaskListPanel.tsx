'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { TaskListHeader } from './TaskListHeader'
import { SectionGroup } from './SectionGroup'
import { QuickAddTask } from './QuickAddTask'
import { DraggableTaskRow } from './DraggableTaskRow'
import { CollapsibleProject } from './CollapsibleProject'
import { DraggableNoteRow } from '@/components/notes/DraggableNoteRow'
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { createDragId, parseDragId } from '@/lib/drag-utils'
import { ChevronRight } from 'lucide-react'

interface TaskListPanelProps {
  className?: string
}

export function TaskListPanel({ className }: TaskListPanelProps) {
  const { selection } = useTaskNavigation()
  const [isAddingSection, setIsAddingSection] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)

  // Fetch tasks based on selection
  const inboxTasks = useQuery(
    api.tasks.listByProject,
    selection.type === 'smart-list' && selection.list === 'inbox'
      ? { projectId: undefined }
      : 'skip'
  )

  const todayTasks = useQuery(
    api.tasks.listToday,
    selection.type === 'smart-list' && selection.list === 'today' ? {} : 'skip'
  )

  const next7Tasks = useQuery(
    api.tasks.listNext7Days,
    selection.type === 'smart-list' && selection.list === 'next7days' ? {} : 'skip'
  )

  const projectTasks = useQuery(
    api.tasks.listByProject,
    selection.type === 'project' ? { projectId: selection.projectId } : 'skip'
  )

  const sections = useQuery(
    api.sections.listByProject,
    selection.type === 'project' ? { projectId: selection.projectId } : 'skip'
  )

  // Fetch notes for inbox or project
  const inboxNotes = useQuery(
    api.notes.listByProject,
    selection.type === 'smart-list' && selection.list === 'inbox'
      ? { projectId: undefined }
      : 'skip'
  )

  const projectNotes = useQuery(
    api.notes.listByProject,
    selection.type === 'project' ? { projectId: selection.projectId } : 'skip'
  )

  // Folder data fetching
  const folderProjects = useQuery(
    api.projects.listByFolder,
    selection.type === 'folder' ? { folderId: selection.folderId } : 'skip'
  )

  // Determine which tasks to show
  let tasks: typeof inboxTasks = undefined
  let isSmartList = false

  let notes: typeof inboxNotes = undefined

  if (selection.type === 'smart-list') {
    isSmartList = true
    switch (selection.list) {
      case 'inbox':
        tasks = inboxTasks
        notes = inboxNotes
        break
      case 'today':
        tasks = todayTasks
        break
      case 'next7days':
        tasks = next7Tasks
        break
    }
  } else if (selection.type === 'project') {
    tasks = projectTasks
    notes = projectNotes
  }
  // For folder view, we don't use the tasks variable - handled separately

  const isLoading = selection.type === 'folder' ? folderProjects === undefined : tasks === undefined

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <TaskListHeader
        onAddSection={() => setIsAddingSection(true)}
        onAddTask={() => setIsAddingTask(true)}
      />

      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        ) : selection.type === 'folder' ? (
          // Folder view - shows all projects in the folder
          <FolderView projects={folderProjects ?? []} />
        ) : isSmartList ? (
          // Smart list view - flat list of tasks
          <SmartListView
            tasks={tasks ?? []}
            notes={notes ?? []}
            projectId={
              selection.type === 'smart-list' && selection.list === 'inbox' ? undefined : undefined
            }
            isAddingTask={isAddingTask}
            onAddingTaskHandled={() => setIsAddingTask(false)}
          />
        ) : (
          // Project view - grouped by sections
          <ProjectView
            tasks={tasks ?? []}
            notes={notes ?? []}
            sections={sections ?? []}
            projectId={selection.type === 'project' ? selection.projectId : undefined}
            isAddingSection={isAddingSection}
            onAddSectionDone={() => setIsAddingSection(false)}
            isAddingTask={isAddingTask}
            onAddingTaskHandled={() => setIsAddingTask(false)}
          />
        )}
      </div>
    </div>
  )
}

interface TaskData {
  _id: Id<'tasks'>
  title: string
  status: 'pending' | 'completed'
  priority?: 'none' | 'low' | 'medium' | 'high' | null
  dueDate?: number | null
  reminders?: number[] | null
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface NoteData {
  _id: Id<'notes'>
  title: string
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface SmartListViewProps {
  tasks: TaskData[]
  notes: NoteData[]
  projectId?: Id<'projects'>
  isAddingTask?: boolean
  onAddingTaskHandled?: () => void
}

function SmartListView({ tasks, notes, isAddingTask, onAddingTaskHandled }: SmartListViewProps) {
  const { selectedNoteId, setSelectedNoteId } = useTaskNavigation()
  const reorderMixed = useMutation(api.notes.reorderMixed)
  const [optimisticMixedOrder, setOptimisticMixedOrder] = useState<Array<{
    type: 'task' | 'note'
    id: string
  }> | null>(null)

  const sortedNotes = notes.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const pendingTasks = tasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  // Combined and sorted items for mixed ordering
  const combinedItems = useMemo(() => {
    if (optimisticMixedOrder) {
      return optimisticMixedOrder
    }
    const items: Array<{ type: 'task' | 'note'; id: string; sortOrder: number }> = [
      ...pendingTasks.map((t) => ({
        type: 'task' as const,
        id: t._id,
        sortOrder: t.sortOrder ?? 0,
      })),
      ...sortedNotes.map((n) => ({
        type: 'note' as const,
        id: n._id,
        sortOrder: n.sortOrder ?? 0,
      })),
    ]
    return items.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [pendingTasks, sortedNotes, optimisticMixedOrder])

  // Listen to drag events from parent DndContext for mixed task/note reordering
  useDndMonitor({
    onDragEnd: async (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id) return

      const activeParsed = parseDragId(active.id as string)
      const overParsed = parseDragId(over.id as string)

      // Only handle task/note reordering
      const isLocalReorder =
        (activeParsed?.type === 'task' || activeParsed?.type === 'note') &&
        (overParsed?.type === 'task' || overParsed?.type === 'note')

      if (!isLocalReorder) return

      const oldIndex = combinedItems.findIndex(
        (i) => createDragId(i.type, i.id) === (active.id as string)
      )
      const newIndex = combinedItems.findIndex(
        (i) => createDragId(i.type, i.id) === (over.id as string)
      )

      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove([...combinedItems], oldIndex, newIndex)
      const newOrder = reordered.map((i) => ({ type: i.type, id: i.id }))

      setOptimisticMixedOrder(newOrder)
      await reorderMixed({ items: newOrder })
      setOptimisticMixedOrder(null)
    },
  })

  if (tasks.length === 0 && notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <p>No tasks or notes</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <SortableContext
        items={combinedItems.map((i) => createDragId(i.type, i.id))}
        strategy={verticalListSortingStrategy}
      >
        {combinedItems.map((item) => {
          if (item.type === 'task') {
            const task = pendingTasks.find((t) => t._id === item.id)
            if (!task) return null
            return (
              <DraggableTaskRow
                key={task._id}
                taskId={task._id}
                title={task.title}
                status={task.status}
                priority={task.priority}
                dueDate={task.dueDate}
                reminders={task.reminders}
              />
            )
          } else {
            const note = sortedNotes.find((n) => n._id === item.id)
            if (!note) return null
            return (
              <DraggableNoteRow
                key={note._id}
                noteId={note._id}
                title={note.title}
                isSelected={selectedNoteId === note._id}
                onSelect={setSelectedNoteId}
              />
            )
          }
        })}
      </SortableContext>

      <QuickAddTask autoOpen={isAddingTask} onAutoOpenHandled={onAddingTaskHandled} />

      {completedTasks.length > 0 && (
        <div className="mt-4 pt-2 border-t border-border">
          <p className="px-3 py-1 text-xs text-muted-foreground mb-1">
            Completed ({completedTasks.length})
          </p>
          {completedTasks.map((task) => (
            <DraggableTaskRow
              key={task._id}
              taskId={task._id}
              title={task.title}
              status={task.status}
              priority={task.priority}
              dueDate={task.dueDate}
              reminders={task.reminders}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ProjectViewProps {
  tasks: TaskData[]
  notes: NoteData[]
  sections: Array<{
    _id: Id<'sections'>
    name: string
    sortOrder: number
  }>
  projectId?: Id<'projects'>
  isAddingSection?: boolean
  onAddSectionDone?: () => void
  isAddingTask?: boolean
  onAddingTaskHandled?: () => void
}

function ProjectView({
  tasks,
  notes,
  sections,
  projectId,
  isAddingSection,
  onAddSectionDone,
  isAddingTask,
  onAddingTaskHandled,
}: ProjectViewProps) {
  const [sectionName, setSectionName] = useState('')
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const createSection = useMutation(api.sections.create)

  // Tasks and notes without a section
  const unsectionedTasks = tasks.filter((t) => !t.sectionId)
  const unsectionedNotes = notes.filter((n) => !n.sectionId)

  // All completed tasks across all sections
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  // Group tasks by section
  const sortedSections = sections.slice().sort((a, b) => a.sortOrder - b.sortOrder)

  useEffect(() => {
    if (isAddingSection && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAddingSection])

  const handleSubmit = async () => {
    const trimmedName = sectionName.trim()
    if (trimmedName && projectId) {
      await createSection({ name: trimmedName, projectId })
    }
    setSectionName('')
    onAddSectionDone?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setSectionName('')
      onAddSectionDone?.()
    }
  }

  return (
    <div>
      {/* Unsectioned tasks and notes - always render for QuickAddTask availability */}
      <SectionGroup
        tasks={unsectionedTasks}
        notes={unsectionedNotes}
        projectId={projectId}
        isAddingTask={isAddingTask}
        onAddingTaskHandled={onAddingTaskHandled}
        hideCompletedSection
      />

      {/* Sectioned tasks and notes */}
      {sortedSections.map((section) => {
        const sectionTasks = tasks.filter((t) => t.sectionId === section._id)
        const sectionNotes = notes.filter((n) => n.sectionId === section._id)
        return (
          <SectionGroup
            key={section._id}
            sectionId={section._id}
            sectionName={section.name}
            tasks={sectionTasks}
            notes={sectionNotes}
            projectId={projectId}
            hideCompletedSection
          />
        )
      })}

      {/* Completed tasks section */}
      {completedTasks.length > 0 && (
        <div className="mt-4 pt-2 border-t border-border">
          <button
            onClick={() => setShowCompletedTasks(!showCompletedTasks)}
            className="flex items-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform', showCompletedTasks && 'rotate-90')}
            />
            Completed ({completedTasks.length})
          </button>

          {showCompletedTasks && (
            <div className="mt-1 space-y-0.5">
              {completedTasks.map((task) => (
                <DraggableTaskRow
                  key={task._id}
                  taskId={task._id}
                  title={task.title}
                  status={task.status}
                  priority={task.priority}
                  dueDate={task.dueDate}
                  reminders={task.reminders}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add section input */}
      {isAddingSection && (
        <div className="px-3 py-2 mt-2">
          <input
            ref={inputRef}
            type="text"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            placeholder="Section name"
            className="w-full text-sm font-medium bg-transparent border-b border-primary outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
    </div>
  )
}

interface FolderViewProps {
  projects: Array<{
    _id: Id<'projects'>
    name: string
    color?: string
  }>
}

function FolderView({ projects }: FolderViewProps) {
  return (
    <div>
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <p>No projects in this folder</p>
        </div>
      ) : (
        <div>
          {projects.map((project) => (
            <FolderProjectWrapper
              key={project._id}
              projectId={project._id}
              projectName={project.name}
              projectColor={project.color}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Wrapper that fetches data for each project in folder view
function FolderProjectWrapper({
  projectId,
  projectName,
  projectColor,
}: {
  projectId: Id<'projects'>
  projectName: string
  projectColor?: string
}) {
  const tasks = useQuery(api.tasks.listByProject, { projectId })
  const notes = useQuery(api.notes.listByProject, { projectId })
  const sections = useQuery(api.sections.listByProject, { projectId })

  if (tasks === undefined || sections === undefined) {
    return null // Loading
  }

  return (
    <CollapsibleProject
      projectId={projectId}
      projectName={projectName}
      projectColor={projectColor}
      tasks={tasks}
      notes={notes ?? []}
      sections={sections}
      hideCompletedSection
    />
  )
}
