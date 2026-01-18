import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

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
