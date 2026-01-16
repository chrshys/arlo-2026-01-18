'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Id } from '../convex/_generated/dataModel'
import { Checkbox } from '@/components/ui/checkbox'

export function TaskList() {
  const tasks = useQuery(api.tasks.list)
  const completeTask = useMutation(api.tasks.completeFromUI)

  const pendingTasks = tasks?.filter((t) => t.status === 'pending') || []
  const completedTasks = tasks?.filter((t) => t.status === 'completed') || []

  const handleComplete = async (taskId: Id<'tasks'>) => {
    try {
      await completeTask({ taskId })
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }

  if (tasks === undefined) {
    return <div className="p-4 text-muted-foreground">Loading tasks...</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Tasks</h2>

      {/* Pending tasks */}
      <div className="space-y-2">
        {pendingTasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pending tasks</p>
        ) : (
          pendingTasks.map((task) => (
            <div key={task._id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
              <Checkbox
                checked={false}
                onCheckedChange={() => handleComplete(task._id)}
                aria-label="Complete task"
              />
              <span className="flex-1">{task.title}</span>
              <span className="text-xs text-muted-foreground">
                {task.createdBy === 'arlo' ? 'Arlo' : 'You'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Completed</h3>
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <div key={task._id} className="flex items-center gap-3 p-2 text-muted-foreground">
                <Checkbox checked disabled aria-label="Completed task" />
                <span className="flex-1 line-through">{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
