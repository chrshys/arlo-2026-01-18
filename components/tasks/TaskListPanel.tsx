'use client'

import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { TaskListHeader } from './TaskListHeader'
import { SectionGroup } from './SectionGroup'
import { QuickAddTask } from './QuickAddTask'
import { TaskRow } from './TaskRow'

interface TaskListPanelProps {
  className?: string
}

export function TaskListPanel({ className }: TaskListPanelProps) {
  const { selection } = useTaskNavigation()

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

  // Determine which tasks to show
  let tasks: typeof inboxTasks = undefined
  let isSmartList = false

  if (selection.type === 'smart-list') {
    isSmartList = true
    switch (selection.list) {
      case 'inbox':
        tasks = inboxTasks
        break
      case 'today':
        tasks = todayTasks
        break
      case 'next7days':
        tasks = next7Tasks
        break
    }
  } else {
    tasks = projectTasks
  }

  const isLoading = tasks === undefined

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <TaskListHeader />

      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        ) : isSmartList ? (
          // Smart list view - flat list of tasks
          <SmartListView
            tasks={tasks ?? []}
            projectId={
              selection.type === 'smart-list' && selection.list === 'inbox' ? undefined : undefined
            }
          />
        ) : (
          // Project view - grouped by sections
          <ProjectView
            tasks={tasks ?? []}
            sections={sections ?? []}
            projectId={selection.type === 'project' ? selection.projectId : undefined}
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
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface SmartListViewProps {
  tasks: TaskData[]
  projectId?: Id<'projects'>
}

function SmartListView({ tasks }: SmartListViewProps) {
  const pendingTasks = tasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <p>No tasks</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {pendingTasks.map((task) => (
        <TaskRow
          key={task._id}
          taskId={task._id}
          title={task.title}
          status={task.status}
          priority={task.priority}
          dueDate={task.dueDate}
        />
      ))}

      <QuickAddTask />

      {completedTasks.length > 0 && (
        <div className="mt-4 pt-2 border-t border-border">
          <p className="px-3 py-1 text-xs text-muted-foreground mb-1">
            Completed ({completedTasks.length})
          </p>
          {completedTasks.map((task) => (
            <TaskRow
              key={task._id}
              taskId={task._id}
              title={task.title}
              status={task.status}
              priority={task.priority}
              dueDate={task.dueDate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ProjectViewProps {
  tasks: TaskData[]
  sections: Array<{
    _id: Id<'sections'>
    name: string
    sortOrder: number
  }>
  projectId?: Id<'projects'>
}

function ProjectView({ tasks, sections, projectId }: ProjectViewProps) {
  // Tasks without a section
  const unsectionedTasks = tasks.filter((t) => !t.sectionId)

  // Group tasks by section
  const sortedSections = sections.slice().sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div>
      {/* Unsectioned tasks */}
      {(unsectionedTasks.length > 0 || sections.length === 0) && (
        <SectionGroup tasks={unsectionedTasks} projectId={projectId} />
      )}

      {/* Sectioned tasks */}
      {sortedSections.map((section) => {
        const sectionTasks = tasks.filter((t) => t.sectionId === section._id)
        return (
          <SectionGroup
            key={section._id}
            sectionId={section._id}
            sectionName={section.name}
            tasks={sectionTasks}
            projectId={projectId}
          />
        )
      })}
    </div>
  )
}
