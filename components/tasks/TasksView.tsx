'use client'

import { TasksSidebar } from './TasksSidebar'
import { TaskListPanel } from './TaskListPanel'
import { TaskDetailPanel } from './TaskDetailPanel'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { TaskNavigationProvider } from '@/hooks/use-task-navigation'

export function TasksView() {
  return (
    <TaskNavigationProvider>
      <Group orientation="horizontal" className="h-full w-full">
        <Panel id="tasks-sidebar" defaultSize={220} minSize={180} maxSize={300}>
          <div className="h-full w-full bg-muted/30 border-r border-border">
            <TasksSidebar />
          </div>
        </Panel>
        <Separator className="w-1 bg-border hover:bg-primary/50 cursor-col-resize outline-none" />
        <Panel id="tasks-list" defaultSize={350} minSize={280}>
          <div className="h-full w-full bg-background">
            <TaskListPanel />
          </div>
        </Panel>
        <Separator className="w-1 bg-border hover:bg-primary/50 cursor-col-resize outline-none" />
        <Panel id="tasks-detail" minSize={300}>
          <div className="h-full w-full bg-background border-l border-border">
            <TaskDetailPanel />
          </div>
        </Panel>
      </Group>
    </TaskNavigationProvider>
  )
}
