import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('folders').collect()
  },
})

export const get = query({
  args: { id: v.id('folders') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const folders = await ctx.db.query('folders').collect()
    const maxSortOrder = folders.reduce((max, f) => Math.max(max, f.sortOrder), -1)

    return await ctx.db.insert('folders', {
      name: args.name,
      color: args.color,
      icon: args.icon,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('folders'),
    name: v.optional(v.string()),
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
  args: { id: v.id('folders') },
  handler: async (ctx, { id }) => {
    // Move projects in this folder to have no folder (Inbox)
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_folder', (q) => q.eq('folderId', id))
      .collect()

    for (const project of projects) {
      await ctx.db.patch(project._id, { folderId: undefined })
    }

    await ctx.db.delete(id)
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('folders')),
  },
  handler: async (ctx, { orderedIds }) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await ctx.db.patch(orderedIds[i], { sortOrder: i })
    }
  },
})
