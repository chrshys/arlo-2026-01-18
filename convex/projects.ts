import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})

export const listByFolder = query({
  args: { folderId: v.optional(v.id('folders')) },
  handler: async (ctx, { folderId }) => {
    const user = await requireCurrentUser(ctx)
    const allProjects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    if (folderId === undefined) {
      return allProjects.filter((p) => p.folderId === undefined)
    }
    return allProjects.filter((p) => p.folderId === folderId)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    folderId: v.optional(v.id('folders')),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const maxSortOrder = projects.reduce((max, p) => Math.max(max, p.sortOrder), -1)

    return await ctx.db.insert('projects', {
      userId: user._id,
      name: args.name,
      folderId: args.folderId,
      color: args.color,
      icon: args.icon,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('projects'),
    name: v.optional(v.string()),
    folderId: v.optional(v.id('folders')),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const project = await ctx.db.get(args.id)
    if (!project || project.userId !== user._id) throw new Error('Not found')

    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered)
    }
  },
})

export const remove = mutation({
  args: { id: v.id('projects') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const project = await ctx.db.get(id)
    if (!project || project.userId !== user._id) throw new Error('Not found')

    // Delete all sections in this project
    const sections = await ctx.db
      .query('sections')
      .withIndex('by_project', (q) => q.eq('projectId', id))
      .collect()

    for (const section of sections) {
      await ctx.db.delete(section._id)
    }

    // Move tasks in this project to have no project
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', id))
      .collect()

    for (const task of tasks) {
      await ctx.db.patch(task._id, { projectId: undefined, sectionId: undefined })
    }

    await ctx.db.delete(id)
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('projects')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const project = await ctx.db.get(orderedIds[i])
      if (project && project.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})

export const moveToFolder = mutation({
  args: {
    id: v.id('projects'),
    folderId: v.optional(v.id('folders')),
  },
  handler: async (ctx, { id, folderId }) => {
    const user = await requireCurrentUser(ctx)
    const project = await ctx.db.get(id)
    if (!project || project.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { folderId })
  },
})
