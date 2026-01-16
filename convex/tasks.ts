import { mutation, query, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// Internal mutation for Arlo to create tasks
export const create = internalMutation({
  args: {
    title: v.string(),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert('tasks', {
      title: args.title,
      status: 'pending',
      createdBy: args.createdBy,
      createdAt: Date.now(),
    })
    return taskId
  },
})

// Internal query for Arlo to list pending tasks
export const listPending = internalQuery({
  handler: async (ctx) => {
    return await ctx.db
      .query('tasks')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect()
  },
})

// Internal mutation for Arlo to complete tasks
export const complete = internalMutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    await ctx.db.patch(taskId, {
      status: 'completed',
      completedAt: Date.now(),
    })
  },
})

// Public query for UI to list all tasks
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('tasks').order('desc').collect()
  },
})

// Public mutation for UI to create tasks
export const createFromUI = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    return await ctx.db.insert('tasks', {
      title,
      status: 'pending',
      createdBy: 'user',
      createdAt: Date.now(),
    })
  },
})

// Public mutation for UI to complete tasks
export const completeFromUI = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    await ctx.db.patch(taskId, {
      status: 'completed',
      completedAt: Date.now(),
    })
  },
})
