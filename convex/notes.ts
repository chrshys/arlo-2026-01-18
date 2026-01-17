import { query } from './_generated/server'
import { v } from 'convex/values'

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
