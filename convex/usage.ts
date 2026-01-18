import { query } from './_generated/server'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { requireCurrentUser } from './lib/auth'

interface ActivityItem {
  _id: string
  _creationTime: number
  model: string | undefined
  threadId: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  } | null
  cost: string | null
}

export const activityLog = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ActivityItem[]> => {
    await requireCurrentUser(ctx)
    const limit = args.limit ?? 25
    const threadPageSize = Math.min(100, Math.max(10, limit * 2))
    const messagesPerThread = Math.min(50, Math.max(5, Math.ceil(limit / 2)))

    // Get all threads for the current user
    const threadsResult = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      order: 'desc',
      paginationOpts: { cursor: null, numItems: threadPageSize },
    })

    const allMessages: ActivityItem[] = []

    // For each thread, get messages with usage data
    for (const thread of threadsResult.page) {
      const messagesResult = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId: thread._id,
        order: 'desc',
        excludeToolMessages: true,
        statuses: ['success'],
        paginationOpts: { cursor: null, numItems: messagesPerThread },
      })

      // Filter to messages with usage/cost data (assistant responses)
      for (const msg of messagesResult.page) {
        if (msg.usage && msg.model) {
          const providerMetadata = msg.providerMetadata as
            | { gateway?: { cost?: string } }
            | undefined

          allMessages.push({
            _id: msg._id,
            _creationTime: msg._creationTime,
            model: msg.model,
            threadId: thread._id,
            usage: {
              promptTokens: msg.usage.promptTokens ?? 0,
              completionTokens: msg.usage.completionTokens ?? 0,
              totalTokens: msg.usage.totalTokens ?? 0,
            },
            cost: providerMetadata?.gateway?.cost ?? null,
          })
        }
      }
    }

    // Sort by creation time descending and take limit
    allMessages.sort((a, b) => b._creationTime - a._creationTime)
    return allMessages.slice(0, limit)
  },
})
