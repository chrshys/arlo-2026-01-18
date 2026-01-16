'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Id } from '../convex/_generated/dataModel'

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
    return <div className="p-4 text-gray-500">Loading tasks...</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Tasks</h2>

      {/* Pending tasks */}
      <div className="space-y-2">
        {pendingTasks.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending tasks</p>
        ) : (
          pendingTasks.map((task) => (
            <div key={task._id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
              <button
                onClick={() => handleComplete(task._id)}
                className="w-5 h-5 rounded border-2 border-gray-300 hover:border-blue-500 flex-shrink-0"
                aria-label="Complete task"
              />
              <span className="flex-1">{task.title}</span>
              <span className="text-xs text-gray-400">
                {task.createdBy === 'arlo' ? 'Arlo' : 'You'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Completed</h3>
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <div key={task._id} className="flex items-center gap-3 p-2 text-gray-400">
                <div className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-3 h-3 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <span className="flex-1 line-through">{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
