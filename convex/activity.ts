import { internalMutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const limit = args.limit || 50

    return await ctx.db
      .query('activity')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(limit)
  },
})

export const log = internalMutation({
  args: {
    userId: v.id('users'),
    action: v.string(),
    actor: v.union(v.literal('user'), v.literal('arlo')),
    outcome: v.union(v.literal('success'), v.literal('error')),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('activity', {
      ...args,
      createdAt: Date.now(),
    })
  },
})
