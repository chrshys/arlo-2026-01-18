import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../../_generated/api'
import { Id } from '../../_generated/dataModel'
import { GMAIL_PROVIDER } from '../../lib/integrationConstants'

// Exported for testing
export function getUserId(ctx: { userId?: string }): Id<'users'> {
  if (!ctx.userId) {
    throw new Error('User context not available')
  }
  return ctx.userId as Id<'users'>
}

export type GmailConnectionResult =
  | { error: string }
  | {
      integration: {
        _id: Id<'integrations'>
        nangoConnectionId: string
        status: string
        gmailPermissionLevel?: 'read' | 'read_draft' | 'read_draft_send'
        gmailRequireConfirmation?: boolean
      }
    }

// Get Gmail connection and check permissions
export async function getGmailConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userId: Id<'users'>,
  requiredLevel?: 'read' | 'read_draft' | 'read_draft_send'
): Promise<GmailConnectionResult> {
  const integration = (await ctx.runQuery(internal.integrations.getByUserIdAndProvider, {
    userId,
    provider: GMAIL_PROVIDER,
  })) as {
    _id: Id<'integrations'>
    nangoConnectionId: string
    status: string
    gmailPermissionLevel?: 'read' | 'read_draft' | 'read_draft_send'
    gmailRequireConfirmation?: boolean
  } | null

  if (!integration) {
    return {
      error: 'Gmail is not connected. Please connect it in Settings → Integrations.',
    }
  }

  if (integration.status !== 'active') {
    return {
      error: 'Gmail connection has expired. Please reconnect in Settings → Integrations.',
    }
  }

  // Check permission level if required
  if (requiredLevel) {
    const level = integration.gmailPermissionLevel || 'read_draft'
    const levels = ['read', 'read_draft', 'read_draft_send']
    const currentIndex = levels.indexOf(level)
    const requiredIndex = levels.indexOf(requiredLevel)

    if (currentIndex < requiredIndex) {
      const levelNames: Record<string, string> = {
        read: 'Read-only',
        read_draft: 'Read + Draft',
        read_draft_send: 'Read + Draft + Send',
      }
      return {
        error: `This action requires "${levelNames[requiredLevel]}" permission. Current level: "${levelNames[level]}". Update in Settings → Integrations.`,
      }
    }
  }

  return { integration }
}

// Check if send requires confirmation
export function requiresSendConfirmation(integration: {
  gmailPermissionLevel?: 'read' | 'read_draft' | 'read_draft_send'
  gmailRequireConfirmation?: boolean
}): boolean {
  if (integration.gmailPermissionLevel !== 'read_draft_send') {
    return true // Can't send without permission anyway
  }
  return integration.gmailRequireConfirmation !== false // Default to true
}

export const searchEmails = createTool({
  description:
    'Search emails using Gmail query syntax. Examples: "from:john@example.com", "subject:meeting", "is:unread", "after:2024/01/01"',
  args: z.object({
    query: z.string().describe('Gmail search query'),
    maxResults: z.number().optional().describe('Max results (default 10)'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read')

    if ('error' in result) {
      return { emails: [], error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.searchMessages, {
        nangoConnectionId: result.integration.nangoConnectionId,
        query: args.query,
        maxResults: args.maxResults || 10,
      })) as {
        messages: Array<{
          id: string
          threadId: string
          subject: string
          from: { name?: string; email: string }
          to: Array<{ name?: string; email: string }>
          date: number
          snippet: string
          labels: string[]
        }>
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'search_emails',
        actor: 'arlo',
        outcome: 'success',
        details: `Searched emails: "${args.query}"`,
      })

      return {
        emails: response.messages.map((m) => ({
          id: m.id,
          threadId: m.threadId,
          subject: m.subject,
          from: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
          date: new Date(m.date).toISOString(),
          snippet: m.snippet,
        })),
      }
    } catch (error) {
      console.error('Failed to search emails:', error)
      return { emails: [], error: 'Failed to search emails' }
    }
  },
})

export const getEmail = createTool({
  description: 'Get full email content by ID',
  args: z.object({
    emailId: z.string().describe('The email ID'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read')

    if ('error' in result) {
      return { email: null, error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.getMessage, {
        nangoConnectionId: result.integration.nangoConnectionId,
        messageId: args.emailId,
      })) as {
        message: {
          id: string
          threadId: string
          subject: string
          from: { name?: string; email: string }
          to: Array<{ name?: string; email: string }>
          date: number
          snippet: string
          body: { text?: string; html?: string }
          labels: string[]
        }
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      const msg = response.message
      return {
        email: {
          id: msg.id,
          threadId: msg.threadId,
          subject: msg.subject,
          from: msg.from.name ? `${msg.from.name} <${msg.from.email}>` : msg.from.email,
          to: msg.to.map((t) => (t.name ? `${t.name} <${t.email}>` : t.email)),
          date: new Date(msg.date).toISOString(),
          body: msg.body.text || msg.body.html || '',
          labels: msg.labels,
        },
      }
    } catch (error) {
      console.error('Failed to get email:', error)
      return { email: null, error: 'Failed to get email' }
    }
  },
})

export const getEmailThread = createTool({
  description: 'Get entire email thread/conversation',
  args: z.object({
    threadId: z.string().describe('The thread ID'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read')

    if ('error' in result) {
      return { thread: null, error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.getThread, {
        nangoConnectionId: result.integration.nangoConnectionId,
        threadId: args.threadId,
      })) as {
        threadId: string
        messages: Array<{
          id: string
          subject: string
          from: { name?: string; email: string }
          to: Array<{ name?: string; email: string }>
          date: number
          body: { text?: string; html?: string }
        }>
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      return {
        thread: {
          id: response.threadId,
          messages: response.messages.map((m) => ({
            id: m.id,
            subject: m.subject,
            from: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
            date: new Date(m.date).toISOString(),
            body: m.body.text || m.body.html || '',
          })),
        },
      }
    } catch (error) {
      console.error('Failed to get thread:', error)
      return { thread: null, error: 'Failed to get email thread' }
    }
  },
})

export const summarizeInbox = createTool({
  description: 'Get summary of recent unread emails',
  args: z.object({
    maxResults: z.number().optional().describe('Max emails to check (default 10)'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read')

    if ('error' in result) {
      return { emails: [], error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.searchMessages, {
        nangoConnectionId: result.integration.nangoConnectionId,
        query: 'is:unread',
        maxResults: args.maxResults || 10,
      })) as {
        messages: Array<{
          id: string
          threadId: string
          subject: string
          from: { name?: string; email: string }
          date: number
          snippet: string
        }>
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'summarize_inbox',
        actor: 'arlo',
        outcome: 'success',
        details: `Found ${response.messages.length} unread emails`,
      })

      return {
        unreadCount: response.messages.length,
        emails: response.messages.map((m) => ({
          id: m.id,
          subject: m.subject,
          from: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
          date: new Date(m.date).toISOString(),
          snippet: m.snippet,
        })),
      }
    } catch (error) {
      console.error('Failed to summarize inbox:', error)
      return { emails: [], error: 'Failed to summarize inbox' }
    }
  },
})
