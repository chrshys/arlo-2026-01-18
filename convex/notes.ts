import { query, mutation, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('notes').order('desc').collect()
  },
})

export const listByProject = query({
  args: { projectId: v.optional(v.id('projects')) },
  handler: async (ctx, { projectId }) => {
    if (projectId === undefined) {
      return await ctx.db
        .query('notes')
        .filter((q) => q.eq(q.field('projectId'), undefined))
        .collect()
    }
    return await ctx.db
      .query('notes')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
  },
})

export const get = query({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
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
    const existingNotes = args.projectId
      ? await ctx.db
          .query('notes')
          .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
          .collect()
      : await ctx.db
          .query('notes')
          .filter((q) => q.eq(q.field('projectId'), undefined))
          .collect()

    const relevantNotes = args.sectionId
      ? existingNotes.filter((n) => n.sectionId === args.sectionId)
      : existingNotes.filter((n) => n.sectionId === undefined)

    const maxSortOrder = relevantNotes.reduce((max, n) => Math.max(max, n.sortOrder ?? 0), -1)

    const now = Date.now()
    return await ctx.db.insert('notes', {
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
    await ctx.db.patch(id, { content, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})

export const moveToProject = mutation({
  args: {
    id: v.id('notes'),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, { id, projectId }) => {
    const targetNotes = projectId
      ? await ctx.db
          .query('notes')
          .withIndex('by_project', (q) => q.eq('projectId', projectId))
          .collect()
      : await ctx.db
          .query('notes')
          .filter((q) => q.eq(q.field('projectId'), undefined))
          .collect()

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
    for (let i = 0; i < items.length; i++) {
      const { type, id } = items[i]
      if (type === 'task') {
        await ctx.db.patch(id as Id<'tasks'>, { sortOrder: i })
      } else {
        await ctx.db.patch(id as Id<'notes'>, { sortOrder: i })
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
    // Get existing items in target to calculate sortOrder
    const existingTasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
    const existingNotes = await ctx.db
      .query('notes')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()

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
    title: v.string(),
    content: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  },
  handler: async (ctx, args) => {
    const existingNotes = args.projectId
      ? await ctx.db
          .query('notes')
          .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
          .collect()
      : await ctx.db
          .query('notes')
          .filter((q) => q.eq(q.field('projectId'), undefined))
          .collect()

    const maxSortOrder = existingNotes.reduce((max, n) => Math.max(max, n.sortOrder ?? 0), -1)

    const now = Date.now()
    return await ctx.db.insert('notes', {
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
  handler: async (ctx) => {
    return await ctx.db.query('notes').order('desc').collect()
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
