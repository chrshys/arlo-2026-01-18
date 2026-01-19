import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

// Called by frontend on app load to ensure user exists in database
export const ensureUser = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (existing) return existing

    // Create user from identity
    const now = Date.now()
    const userId = await ctx.db.insert('users', {
      clerkId: identity.subject,
      email: identity.email ?? '',
      name: identity.name ?? undefined,
      imageUrl: identity.pictureUrl ?? undefined,
      createdAt: now,
      updatedAt: now,
    })

    return await ctx.db.get(userId)
  },
})

export const upsert = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const deleteByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique()

    if (user) {
      // Note: In production, you might want to cascade delete or anonymize user data
      await ctx.db.delete(user._id)
    }
  },
})

export const getByClerkId = internalQuery({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique()
  },
})

// Get user's timezone (for internal use by tools)
export const getTimezone = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    return user?.timezone || 'America/New_York'
  },
})

// Get current user's profile
export const me = query({
  args: {},
  handler: async (ctx) => {
    return await requireCurrentUser(ctx)
  },
})

// Update current user's timezone
export const updateTimezone = mutation({
  args: {
    timezone: v.string(),
  },
  handler: async (ctx, { timezone }) => {
    const user = await requireCurrentUser(ctx)
    await ctx.db.patch(user._id, {
      timezone,
      updatedAt: Date.now(),
    })
  },
})
