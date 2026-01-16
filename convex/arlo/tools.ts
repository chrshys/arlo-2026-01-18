import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../_generated/api'

export const createTask = createTool({
  description: 'Create a new task',
  args: z.object({
    title: z.string().describe('The task title'),
  }),
  handler: async (ctx, args): Promise<{ taskId: string; message: string }> => {
    const taskId = await ctx.runMutation(internal.tasks.create, {
      title: args.title,
      createdBy: 'arlo',
    })
    return { taskId, message: `Created task: ${args.title}` }
  },
})

export const listTasks = createTool({
  description: 'List all pending tasks',
  args: z.object({}),
  handler: async (ctx): Promise<{ tasks: Array<{ id: string; title: string }> }> => {
    const tasks = await ctx.runQuery(internal.tasks.listPending)
    return { tasks: tasks.map((t) => ({ id: t._id, title: t.title })) }
  },
})

export const completeTask = createTool({
  description: 'Mark a task as completed',
  args: z.object({
    taskId: z.string().describe('The ID of the task to complete'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    await ctx.runMutation(internal.tasks.complete, { taskId: args.taskId })
    return { message: 'Task completed' }
  },
})
