import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const listByTask = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const user = await requireCurrentUser(ctx)

    // Verify task belongs to user
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== user._id) return []

    return await ctx.db
      .query('subtasks')
      .withIndex('by_task', (q) => q.eq('taskId', taskId))
      .collect()
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Verify task belongs to user
    const task = await ctx.db.get(args.taskId)
    if (!task || task.userId !== user._id) throw new Error('Task not found')

    const subtasks = await ctx.db
      .query('subtasks')
      .withIndex('by_task', (q) => q.eq('taskId', args.taskId))
      .collect()
    const maxSortOrder = subtasks.reduce((max, s) => Math.max(max, s.sortOrder), -1)

    return await ctx.db.insert('subtasks', {
      userId: user._id,
      title: args.title,
      taskId: args.taskId,
      completed: false,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('subtasks'),
    title: v.optional(v.string()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const subtask = await ctx.db.get(args.id)
    if (!subtask || subtask.userId !== user._id) throw new Error('Not found')

    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered)
    }
  },
})

export const remove = mutation({
  args: { id: v.id('subtasks') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const subtask = await ctx.db.get(id)
    if (!subtask || subtask.userId !== user._id) throw new Error('Not found')

    await ctx.db.delete(id)
  },
})

export const toggle = mutation({
  args: { id: v.id('subtasks') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const subtask = await ctx.db.get(id)
    if (!subtask || subtask.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { completed: !subtask.completed })
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('subtasks')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const subtask = await ctx.db.get(orderedIds[i])
      if (subtask && subtask.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})
