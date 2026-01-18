import { mutation, query, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

const priorityValidator = v.union(
  v.literal('none'),
  v.literal('low'),
  v.literal('medium'),
  v.literal('high')
)

// Public query for UI to list all tasks
export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()
  },
})

// List tasks by project
export const listByProject = query({
  args: { projectId: v.optional(v.id('projects')) },
  handler: async (ctx, { projectId }) => {
    const user = await requireCurrentUser(ctx)
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    if (projectId === undefined) {
      return allTasks.filter((t) => t.projectId === undefined)
    }
    return allTasks.filter((t) => t.projectId === projectId)
  },
})

// List tasks due today
export const listToday = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    return tasks.filter(
      (t) =>
        t.status === 'pending' &&
        t.dueDate !== undefined &&
        t.dueDate >= startOfDay &&
        t.dueDate <= endOfDay
    )
  },
})

// List tasks due in next 7 days
export const listNext7Days = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const endOfWeek = startOfDay + 7 * 24 * 60 * 60 * 1000 - 1

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    return tasks.filter(
      (t) =>
        t.status === 'pending' &&
        t.dueDate !== undefined &&
        t.dueDate >= startOfDay &&
        t.dueDate <= endOfWeek
    )
  },
})

// Public mutation for UI to create tasks
export const createFromUI = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Get max sort order for the project/section
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const existingTasks = args.projectId
      ? allTasks.filter((t) => t.projectId === args.projectId)
      : allTasks.filter((t) => t.projectId === undefined)

    const relevantTasks = args.sectionId
      ? existingTasks.filter((t) => t.sectionId === args.sectionId)
      : existingTasks.filter((t) => t.sectionId === undefined)

    const maxSortOrder = relevantTasks.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), -1)

    return await ctx.db.insert('tasks', {
      userId: user._id,
      title: args.title,
      description: args.description,
      projectId: args.projectId,
      sectionId: args.sectionId,
      status: 'pending',
      priority: args.priority ?? 'none',
      dueDate: args.dueDate,
      reminders: [],
      sortOrder: maxSortOrder + 1,
      createdBy: 'user',
      createdAt: Date.now(),
    })
  },
})

// Update task
export const update = mutation({
  args: {
    id: v.id('tasks'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
    reminders: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(args.id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered)
    }
  },
})

// Clear optional fields (for removing values)
export const clearField = mutation({
  args: {
    id: v.id('tasks'),
    field: v.union(
      v.literal('description'),
      v.literal('projectId'),
      v.literal('sectionId'),
      v.literal('dueDate')
    ),
  },
  handler: async (ctx, { id, field }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { [field]: undefined })
  },
})

// Public mutation for UI to complete tasks
export const completeFromUI = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(taskId, {
      status: 'completed',
      completedAt: Date.now(),
    })
  },
})

// Reopen a completed task
export const reopen = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(taskId, {
      status: 'pending',
      completedAt: undefined,
    })
  },
})

// Delete task
export const remove = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    // Delete all subtasks
    const subtasks = await ctx.db
      .query('subtasks')
      .withIndex('by_task', (q) => q.eq('taskId', id))
      .collect()

    for (const subtask of subtasks) {
      await ctx.db.delete(subtask._id)
    }

    await ctx.db.delete(id)
  },
})

// Reorder tasks
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('tasks')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const task = await ctx.db.get(orderedIds[i])
      if (task && task.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})

// Move task to project/section
export const move = mutation({
  args: {
    id: v.id('tasks'),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { id, projectId, sectionId }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { projectId, sectionId })
  },
})

// Move task to a different project (drag and drop)
export const moveToProject = mutation({
  args: {
    id: v.id('tasks'),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { id, projectId, sectionId }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    // Get existing tasks in the target project
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const targetTasks = projectId
      ? allTasks.filter((t) => t.projectId === projectId)
      : allTasks.filter((t) => t.projectId === undefined)

    const sectionTasks = targetTasks.filter((t) =>
      sectionId ? t.sectionId === sectionId : t.sectionId === undefined
    )

    const minSortOrder = sectionTasks.reduce((min, t) => Math.min(min, t.sortOrder ?? 0), 0)

    await ctx.db.patch(id, {
      projectId,
      sectionId,
      sortOrder: minSortOrder - 1,
    })
  },
})

// Set due date to today
export const setDueToday = mutation({
  args: {
    id: v.id('tasks'),
  },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    await ctx.db.patch(id, { dueDate: startOfDay })
  },
})

// Add reminder
export const addReminder = mutation({
  args: {
    id: v.id('tasks'),
    reminderTime: v.number(),
  },
  handler: async (ctx, { id, reminderTime }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    const reminders = [...(task.reminders ?? []), reminderTime].sort((a, b) => a - b)
    await ctx.db.patch(id, { reminders })
  },
})

// Remove reminder
export const removeReminder = mutation({
  args: {
    id: v.id('tasks'),
    reminderTime: v.number(),
  },
  handler: async (ctx, { id, reminderTime }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    const reminders = (task.reminders ?? []).filter((r) => r !== reminderTime)
    await ctx.db.patch(id, { reminders })
  },
})

// Internal mutation for Arlo to create tasks
export const create = internalMutation({
  args: {
    userId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  },
  handler: async (ctx, args) => {
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const existingTasks = args.projectId
      ? allTasks.filter((t) => t.projectId === args.projectId)
      : allTasks.filter((t) => t.projectId === undefined)

    const maxSortOrder = existingTasks.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), -1)

    return await ctx.db.insert('tasks', {
      userId: args.userId,
      title: args.title,
      description: args.description,
      projectId: args.projectId,
      sectionId: args.sectionId,
      status: 'pending',
      priority: args.priority ?? 'none',
      dueDate: args.dueDate,
      reminders: [],
      sortOrder: maxSortOrder + 1,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    })
  },
})

// Internal query for Arlo to list pending tasks
export const listPending = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    return tasks.filter((t) => t.status === 'pending')
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
