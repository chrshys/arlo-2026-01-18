import { internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'

export const moveTask = internalMutation({
  args: {
    taskId: v.id('tasks'),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { taskId, projectId, sectionId }) => {
    await ctx.db.patch(taskId, { projectId, sectionId })
  },
})

export const addReminder = internalMutation({
  args: {
    taskId: v.id('tasks'),
    reminderTime: v.number(),
  },
  handler: async (ctx, { taskId, reminderTime }) => {
    const task = await ctx.db.get(taskId)
    if (!task) return

    const reminders = [...(task.reminders ?? []), reminderTime].sort((a, b) => a - b)
    await ctx.db.patch(taskId, { reminders })
  },
})

export const listProjectsAndFolders = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const folders = await ctx.db
      .query('folders')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    return {
      projects: projects.map((p) => ({
        id: p._id,
        name: p.name,
        folderId: p.folderId,
      })),
      folders: folders.map((f) => ({
        id: f._id,
        name: f.name,
      })),
    }
  },
})

export const updateTaskPriority = internalMutation({
  args: {
    taskId: v.id('tasks'),
    priority: v.union(v.literal('none'), v.literal('low'), v.literal('medium'), v.literal('high')),
  },
  handler: async (ctx, { taskId, priority }) => {
    await ctx.db.patch(taskId, { priority })
  },
})

export const updateTaskDueDate = internalMutation({
  args: {
    taskId: v.id('tasks'),
    dueDate: v.number(),
  },
  handler: async (ctx, { taskId, dueDate }) => {
    await ctx.db.patch(taskId, { dueDate })
  },
})
