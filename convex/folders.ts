import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('folders')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})

export const get = query({
  args: { id: v.id('folders') },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const folder = await ctx.db.get(args.id)
    if (!folder || folder.userId !== user._id) return null
    return folder
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Get max sortOrder from both folders and standalone projects (unified sidebar ordering)
    const folders = await ctx.db
      .query('folders')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const standaloneProjects = projects.filter((p) => !p.folderId)

    const maxFolderOrder = folders.reduce((max, f) => Math.max(max, f.sortOrder), -1)
    const maxProjectOrder = standaloneProjects.reduce((max, p) => Math.max(max, p.sortOrder), -1)
    const maxSortOrder = Math.max(maxFolderOrder, maxProjectOrder)

    return await ctx.db.insert('folders', {
      userId: user._id,
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
    const user = await requireCurrentUser(ctx)
    const folder = await ctx.db.get(args.id)
    if (!folder || folder.userId !== user._id) throw new Error('Not found')

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
    const user = await requireCurrentUser(ctx)
    const folder = await ctx.db.get(id)
    if (!folder || folder.userId !== user._id) throw new Error('Not found')

    // Move projects in this folder to have no folder (Inbox)
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_folder', (q) => q.eq('folderId', id))
      .collect()

    for (const project of projects) {
      if (project.userId === user._id) {
        await ctx.db.patch(project._id, { folderId: undefined })
      }
    }

    await ctx.db.delete(id)
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('folders')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const folder = await ctx.db.get(orderedIds[i])
      if (folder && folder.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})
