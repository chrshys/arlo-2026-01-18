import { mutation, query } from './_generated/server'
import { createThread, listMessages } from '@convex-dev/agent'
import { components } from './_generated/api'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const list = query({
  handler: async (ctx) => {
    await requireCurrentUser(ctx)
    const result = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      order: 'desc',
      paginationOpts: { numItems: 50, cursor: null },
    })
    return result.page
  },
})

export const create = mutation({
  handler: async (ctx) => {
    await requireCurrentUser(ctx)
    return await createThread(ctx, components.agent, {})
  },
})

export const messages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { threadId, paginationOpts }) => {
    await requireCurrentUser(ctx)
    return await listMessages(ctx, components.agent, {
      threadId,
      paginationOpts,
    })
  },
})
