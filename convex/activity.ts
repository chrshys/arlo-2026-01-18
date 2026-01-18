import { internalMutation } from './_generated/server'
import { v } from 'convex/values'

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
