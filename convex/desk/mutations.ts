import { mutation, internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from '../lib/auth'

export const create = mutation({
  args: {
    type: v.union(
      v.literal('approval'),
      v.literal('question'),
      v.literal('task'),
      v.literal('draft'),
      v.literal('progress')
    ),
    zone: v.union(v.literal('attention'), v.literal('pinned'), v.literal('working')),
    title: v.string(),
    description: v.optional(v.string()),
    data: v.optional(v.any()),
    sourceThreadId: v.optional(v.string()),
    linkedEntityId: v.optional(v.string()),
    linkedEntityType: v.optional(v.string()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    return await ctx.db.insert('deskItems', {
      userId: user._id,
      type: args.type,
      zone: args.zone,
      title: args.title,
      description: args.description,
      data: args.data,
      sourceThreadId: args.sourceThreadId,
      linkedEntityId: args.linkedEntityId,
      linkedEntityType: args.linkedEntityType,
      createdBy: args.createdBy,
      priority: args.priority,
      status: 'active',
    })
  },
})

// Internal version for Arlo to call from actions
export const createInternal = internalMutation({
  args: {
    userId: v.id('users'),
    type: v.union(
      v.literal('approval'),
      v.literal('question'),
      v.literal('task'),
      v.literal('draft'),
      v.literal('progress')
    ),
    zone: v.union(v.literal('attention'), v.literal('pinned'), v.literal('working')),
    title: v.string(),
    description: v.optional(v.string()),
    data: v.optional(v.any()),
    sourceThreadId: v.optional(v.string()),
    linkedEntityId: v.optional(v.string()),
    linkedEntityType: v.optional(v.string()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('deskItems', {
      userId: args.userId,
      type: args.type,
      zone: args.zone,
      title: args.title,
      description: args.description,
      data: args.data,
      sourceThreadId: args.sourceThreadId,
      linkedEntityId: args.linkedEntityId,
      linkedEntityType: args.linkedEntityType,
      createdBy: 'arlo',
      priority: args.priority,
      status: 'active',
    })
  },
})

export const resolve = mutation({
  args: {
    id: v.id('deskItems'),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    await ctx.db.patch(args.id, {
      status: 'resolved',
      resolution: args.resolution,
      resolvedAt: Date.now(),
    })
  },
})

export const dismiss = mutation({
  args: {
    id: v.id('deskItems'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    await ctx.db.patch(args.id, {
      status: 'dismissed',
      resolvedAt: Date.now(),
    })
  },
})

export const pin = mutation({
  args: {
    id: v.id('deskItems'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    await ctx.db.patch(args.id, {
      zone: 'pinned',
    })
  },
})

export const unpin = mutation({
  args: {
    id: v.id('deskItems'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    // When unpinning, move back to attention zone
    await ctx.db.patch(args.id, {
      zone: 'attention',
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('deskItems'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    data: v.optional(v.any()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    const updates: Record<string, unknown> = {}
    if (args.title !== undefined) updates.title = args.title
    if (args.description !== undefined) updates.description = args.description
    if (args.data !== undefined) updates.data = args.data
    if (args.priority !== undefined) updates.priority = args.priority

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.id, updates)
    }
  },
})

// Internal version for updating progress
export const updateProgress = internalMutation({
  args: {
    id: v.id('deskItems'),
    percent: v.optional(v.number()),
    status: v.optional(v.union(v.literal('running'), v.literal('completed'), v.literal('failed'))),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id)
    if (!item) return

    const data = (item.data as { operation?: string; percent?: number; status?: string }) || {}
    const updates: Record<string, unknown> = {
      data: {
        ...data,
        percent: args.percent ?? data.percent,
        status: args.status ?? data.status,
      },
    }

    // If completed/failed, mark resolved
    if (args.status === 'completed' || args.status === 'failed') {
      updates.status = 'resolved'
      updates.resolvedAt = Date.now()
      updates.resolution = args.status
    }

    await ctx.db.patch(args.id, updates)
  },
})
