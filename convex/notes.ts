import { query, mutation, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { requireCurrentUser } from './lib/auth'

export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()
  },
})

export const listByProject = query({
  args: { projectId: v.optional(v.id('projects')) },
  handler: async (ctx, { projectId }) => {
    const user = await requireCurrentUser(ctx)
    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    if (projectId === undefined) {
      return allNotes.filter((n) => n.projectId === undefined)
    }
    return allNotes.filter((n) => n.projectId === projectId)
  },
})

export const get = query({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(id)
    if (!note || note.userId !== user._id) return null
    return note
  },
})

// Create note from UI
export const createFromUI = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const existingNotes = args.projectId
      ? allNotes.filter((n) => n.projectId === args.projectId)
      : allNotes.filter((n) => n.projectId === undefined)

    const relevantNotes = args.sectionId
      ? existingNotes.filter((n) => n.sectionId === args.sectionId)
      : existingNotes.filter((n) => n.sectionId === undefined)

    const maxSortOrder = relevantNotes.reduce((max, n) => Math.max(max, n.sortOrder ?? 0), -1)

    const now = Date.now()
    return await ctx.db.insert('notes', {
      userId: user._id,
      title: args.title,
      content: args.content ?? '',
      projectId: args.projectId,
      sectionId: args.sectionId,
      sortOrder: maxSortOrder + 1,
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('notes'),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(args.id)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() })
    }
  },
})

export const updateContent = mutation({
  args: {
    id: v.id('notes'),
    content: v.string(),
  },
  handler: async (ctx, { id, content }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(id)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { content, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(id)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    await ctx.db.delete(id)
  },
})

export const moveToProject = mutation({
  args: {
    id: v.id('notes'),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, { id, projectId }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(id)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const targetNotes = projectId
      ? allNotes.filter((n) => n.projectId === projectId)
      : allNotes.filter((n) => n.projectId === undefined)

    const unsectionedNotes = targetNotes.filter((n) => n.sectionId === undefined)
    const minSortOrder = unsectionedNotes.reduce((min, n) => Math.min(min, n.sortOrder ?? 0), 0)

    await ctx.db.patch(id, {
      projectId,
      sectionId: undefined,
      sortOrder: minSortOrder - 1,
      updatedAt: Date.now(),
    })
  },
})

export const reorderMixed = mutation({
  args: {
    items: v.array(
      v.object({
        type: v.union(v.literal('task'), v.literal('note')),
        id: v.string(),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < items.length; i++) {
      const { type, id } = items[i]
      if (type === 'task') {
        const task = await ctx.db.get(id as Id<'tasks'>)
        if (task && task.userId === user._id) {
          await ctx.db.patch(id as Id<'tasks'>, { sortOrder: i })
        }
      } else {
        const note = await ctx.db.get(id as Id<'notes'>)
        if (note && note.userId === user._id) {
          await ctx.db.patch(id as Id<'notes'>, { sortOrder: i })
        }
      }
    }
  },
})

export const moveToSection = mutation({
  args: {
    noteId: v.id('notes'),
    projectId: v.id('projects'),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { noteId, projectId, sectionId }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(noteId)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const existingTasks = allTasks.filter((t) => t.projectId === projectId)
    const existingNotes = allNotes.filter((n) => n.projectId === projectId)

    const relevantTasks = sectionId
      ? existingTasks.filter((t) => t.sectionId === sectionId)
      : existingTasks.filter((t) => t.sectionId === undefined)
    const relevantNotes = sectionId
      ? existingNotes.filter((n) => n.sectionId === sectionId)
      : existingNotes.filter((n) => n.sectionId === undefined)

    const maxSortOrder = Math.max(
      ...relevantTasks.map((t) => t.sortOrder ?? 0),
      ...relevantNotes.map((n) => n.sortOrder ?? 0),
      -1
    )

    await ctx.db.patch(noteId, {
      projectId,
      sectionId,
      sortOrder: maxSortOrder + 1,
      updatedAt: Date.now(),
    })
  },
})

// Internal mutation for Arlo to create notes
export const create = internalMutation({
  args: {
    userId: v.id('users'),
    title: v.string(),
    content: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  },
  handler: async (ctx, args) => {
    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const existingNotes = args.projectId
      ? allNotes.filter((n) => n.projectId === args.projectId)
      : allNotes.filter((n) => n.projectId === undefined)

    const maxSortOrder = existingNotes.reduce((max, n) => Math.max(max, n.sortOrder ?? 0), -1)

    const now = Date.now()
    return await ctx.db.insert('notes', {
      userId: args.userId,
      title: args.title,
      content: args.content ?? '',
      projectId: args.projectId,
      sectionId: undefined,
      sortOrder: maxSortOrder + 1,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const listAll = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
  },
})

export const updateContentInternal = internalMutation({
  args: {
    id: v.id('notes'),
    content: v.string(),
  },
  handler: async (ctx, { id, content }) => {
    await ctx.db.patch(id, { content, updatedAt: Date.now() })
  },
})
