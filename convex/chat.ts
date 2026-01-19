import { mutation, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { saveMessage } from '@convex-dev/agent'
import { components, internal } from './_generated/api'
import { arlo } from './arlo/agent'
import { requireCurrentUser } from './lib/auth'

// User sends a message
export const send = mutation({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    // Require authenticated user
    const user = await requireCurrentUser(ctx)

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    })

    // Set thread title from first message if not already set
    // Component uses its own ID type, so we need type assertion
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId } as any)
    if (thread && !thread.title) {
      const title = prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt
      await ctx.runMutation(components.agent.threads.updateThread, {
        threadId,
        patch: { title },
      } as any)
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    await ctx.scheduler.runAfter(0, internal.chat.generateResponse, {
      threadId,
      promptMessageId: messageId,
      userId: user._id,
    })
    return messageId
  },
})

// Arlo generates a response
export const generateResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    userId: v.id('users'),
  },
  handler: async (ctx, { threadId, promptMessageId, userId }) => {
    await arlo.generateText(ctx, { userId, threadId }, { promptMessageId })
  },
})
