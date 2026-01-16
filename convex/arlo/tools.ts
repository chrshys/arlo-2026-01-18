import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../_generated/api'
import { Id } from '../_generated/dataModel'

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
    await ctx.runMutation(internal.activity.log, {
      action: 'create_task',
      actor: 'arlo',
      outcome: 'success',
      targetId: taskId,
      details: `Created task: ${args.title}`,
    })
    return { taskId, message: `Created task: ${args.title}` }
  },
})

export const listTasks = createTool({
  description: 'List all pending tasks',
  args: z.object({}),
  handler: async (ctx): Promise<{ tasks: Array<{ id: string; title: string }> }> => {
    const tasks = await ctx.runQuery(internal.tasks.listPending)
    await ctx.runMutation(internal.activity.log, {
      action: 'list_tasks',
      actor: 'arlo',
      outcome: 'success',
      details: `Listed ${tasks.length} pending tasks`,
    })
    return { tasks: tasks.map((t) => ({ id: t._id, title: t.title })) }
  },
})

export const completeTask = createTool({
  description: 'Mark a task as completed',
  args: z.object({
    taskId: z.string().describe('The ID of the task to complete'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    await ctx.runMutation(internal.tasks.complete, { taskId: args.taskId as Id<'tasks'> })
    await ctx.runMutation(internal.activity.log, {
      action: 'complete_task',
      actor: 'arlo',
      outcome: 'success',
      targetId: args.taskId,
      details: 'Completed task',
    })
    return { message: 'Task completed' }
  },
})
