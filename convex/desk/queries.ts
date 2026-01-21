import { query } from '../_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from '../lib/auth'

export const listByZone = query({
  args: {
    zone: v.union(v.literal('attention'), v.literal('pinned'), v.literal('working')),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    return await ctx.db
      .query('deskItems')
      .withIndex('by_user_zone', (q) => q.eq('userId', user._id).eq('zone', args.zone))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .order('desc')
      .collect()
  },
})

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)

    return await ctx.db
      .query('deskItems')
      .withIndex('by_user_status', (q) => q.eq('userId', user._id).eq('status', 'active'))
      .order('desc')
      .collect()
  },
})

export const get = query({
  args: { id: v.id('deskItems') },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      return null
    }

    return item
  },
})
