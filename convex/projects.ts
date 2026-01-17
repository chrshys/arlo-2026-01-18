import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('projects').collect()
  },
})

export const listByFolder = query({
  args: { folderId: v.optional(v.id('folders')) },
  handler: async (ctx, { folderId }) => {
    if (folderId === undefined) {
      // Get projects without a folder (Inbox projects)
      return await ctx.db
        .query('projects')
        .filter((q) => q.eq(q.field('folderId'), undefined))
        .collect()
    }
    return await ctx.db
      .query('projects')
      .withIndex('by_folder', (q) => q.eq('folderId', folderId))
      .collect()
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
    const projects = await ctx.db.query('projects').collect()
    const maxSortOrder = projects.reduce((max, p) => Math.max(max, p.sortOrder), -1)

    return await ctx.db.insert('projects', {
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
    for (let i = 0; i < orderedIds.length; i++) {
      await ctx.db.patch(orderedIds[i], { sortOrder: i })
    }
  },
})

export const moveToFolder = mutation({
  args: {
    id: v.id('projects'),
    folderId: v.optional(v.id('folders')),
  },
  handler: async (ctx, { id, folderId }) => {
    await ctx.db.patch(id, { folderId })
  },
})
