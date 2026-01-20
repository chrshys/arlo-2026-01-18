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

export const createDraft = createTool({
  description: 'Create a draft email',
  args: z.object({
    to: z.array(z.string()).describe('Recipient email addresses'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (plain text)'),
    replyToMessageId: z.string().optional().describe('Message ID if replying to an email'),
    threadId: z.string().optional().describe('Thread ID to add to existing conversation'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft')

    if ('error' in result) {
      return { draftId: null, error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.createDraft, {
        nangoConnectionId: result.integration.nangoConnectionId,
        to: args.to,
        subject: args.subject,
        body: args.body,
        replyToMessageId: args.replyToMessageId,
        threadId: args.threadId,
      })) as { draftId: string; messageId: string; threadId: string }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'email_draft_created',
        actor: 'arlo',
        outcome: 'success',
        targetId: response.draftId,
        details: `Created draft: "${args.subject}" to ${args.to.join(', ')}`,
      })

      return {
        draftId: response.draftId,
        message: `Draft created: "${args.subject}" to ${args.to.join(', ')}`,
      }
    } catch (error) {
      console.error('Failed to create draft:', error)
      return { draftId: null, error: 'Failed to create draft' }
    }
  },
})

export const sendEmail = createTool({
  description:
    'Send an email. If confirmation is required in settings, creates a draft instead and returns pending status.',
  args: z.object({
    to: z.array(z.string()).describe('Recipient email addresses'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (plain text)'),
    replyToMessageId: z.string().optional().describe('Message ID if replying'),
    threadId: z.string().optional().describe('Thread ID for existing conversation'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft_send')

    if ('error' in result) {
      return { status: 'error', error: result.error }
    }

    // Check if confirmation is required
    if (requiresSendConfirmation(result.integration)) {
      // Create draft instead
      try {
        const draftResponse = (await ctx.runAction(internal.arlo.gmailActions.createDraft, {
          nangoConnectionId: result.integration.nangoConnectionId,
          to: args.to,
          subject: args.subject,
          body: args.body,
          replyToMessageId: args.replyToMessageId,
          threadId: args.threadId,
        })) as { draftId: string }

        await ctx.runMutation(internal.activity.log, {
          userId,
          action: 'email_draft_created',
          actor: 'arlo',
          outcome: 'success',
          targetId: draftResponse.draftId,
          details: `Draft pending confirmation: "${args.subject}" to ${args.to.join(', ')}`,
        })

        return {
          status: 'pending_confirmation',
          draftId: draftResponse.draftId,
          message: `Draft created for "${args.subject}" to ${args.to.join(', ')}. Reply "send it" to confirm, or "cancel" to delete.`,
        }
      } catch (error) {
        console.error('Failed to create draft:', error)
        return { status: 'error', error: 'Failed to create draft' }
      }
    }

    // Send directly
    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.sendMessage, {
        nangoConnectionId: result.integration.nangoConnectionId,
        to: args.to,
        subject: args.subject,
        body: args.body,
        replyToMessageId: args.replyToMessageId,
        threadId: args.threadId,
      })) as { messageId: string; threadId: string }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'email_sent',
        actor: 'arlo',
        outcome: 'success',
        targetId: response.messageId,
        details: `Sent: "${args.subject}" to ${args.to.join(', ')}`,
      })

      return {
        status: 'sent',
        messageId: response.messageId,
        message: `Email sent: "${args.subject}" to ${args.to.join(', ')}`,
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      return { status: 'error', error: 'Failed to send email' }
    }
  },
})

export const sendDraft = createTool({
  description: 'Send an existing draft (for confirming pending drafts)',
  args: z.object({
    draftId: z.string().describe('The draft ID to send'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft_send')

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.sendDraft, {
        nangoConnectionId: result.integration.nangoConnectionId,
        draftId: args.draftId,
      })) as { messageId: string; threadId: string }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'email_sent',
        actor: 'arlo',
        outcome: 'success',
        targetId: response.messageId,
        details: 'Sent draft email',
      })

      return {
        success: true,
        messageId: response.messageId,
        message: 'Email sent successfully',
      }
    } catch (error) {
      console.error('Failed to send draft:', error)
      return { success: false, error: 'Failed to send draft' }
    }
  },
})

export const deleteDraft = createTool({
  description: 'Delete a draft (for cancelling pending drafts)',
  args: z.object({
    draftId: z.string().describe('The draft ID to delete'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft')

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      await ctx.runAction(internal.arlo.gmailActions.deleteDraft, {
        nangoConnectionId: result.integration.nangoConnectionId,
        draftId: args.draftId,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'email_draft_cancelled',
        actor: 'arlo',
        outcome: 'success',
        targetId: args.draftId,
        details: 'Deleted draft email',
      })

      return { success: true, message: 'Draft deleted' }
    } catch (error) {
      console.error('Failed to delete draft:', error)
      return { success: false, error: 'Failed to delete draft' }
    }
  },
})

export const listLabels = createTool({
  description: 'List all Gmail labels (both system and custom)',
  args: z.object({}),
  handler: async (ctx) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read')

    if ('error' in result) {
      return { labels: [], error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.listLabels, {
        nangoConnectionId: result.integration.nangoConnectionId,
      })) as {
        labels: Array<{ id: string; name: string; type: string }>
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      return {
        labels: response.labels.map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
        })),
      }
    } catch (error) {
      console.error('Failed to list labels:', error)
      return { labels: [], error: 'Failed to list labels' }
    }
  },
})

export const applyLabel = createTool({
  description: 'Apply a label to one or more emails',
  args: z.object({
    emailIds: z.array(z.string()).describe('Email IDs to label'),
    labelId: z.string().describe('Label ID to apply'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft_send')

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      if (args.emailIds.length === 1) {
        await ctx.runAction(internal.arlo.gmailActions.modifyMessageLabels, {
          nangoConnectionId: result.integration.nangoConnectionId,
          messageId: args.emailIds[0],
          addLabelIds: [args.labelId],
        })
      } else {
        await ctx.runAction(internal.arlo.gmailActions.batchModifyLabels, {
          nangoConnectionId: result.integration.nangoConnectionId,
          messageIds: args.emailIds,
          addLabelIds: [args.labelId],
        })
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      return {
        success: true,
        message: `Applied label to ${args.emailIds.length} email(s)`,
      }
    } catch (error) {
      console.error('Failed to apply label:', error)
      return { success: false, error: 'Failed to apply label' }
    }
  },
})

export const removeLabel = createTool({
  description: 'Remove a label from one or more emails',
  args: z.object({
    emailIds: z.array(z.string()).describe('Email IDs'),
    labelId: z.string().describe('Label ID to remove'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft_send')

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      if (args.emailIds.length === 1) {
        await ctx.runAction(internal.arlo.gmailActions.modifyMessageLabels, {
          nangoConnectionId: result.integration.nangoConnectionId,
          messageId: args.emailIds[0],
          removeLabelIds: [args.labelId],
        })
      } else {
        await ctx.runAction(internal.arlo.gmailActions.batchModifyLabels, {
          nangoConnectionId: result.integration.nangoConnectionId,
          messageIds: args.emailIds,
          removeLabelIds: [args.labelId],
        })
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      return {
        success: true,
        message: `Removed label from ${args.emailIds.length} email(s)`,
      }
    } catch (error) {
      console.error('Failed to remove label:', error)
      return { success: false, error: 'Failed to remove label' }
    }
  },
})

export const archiveEmail = createTool({
  description: 'Archive emails (remove from inbox)',
  args: z.object({
    emailIds: z.array(z.string()).describe('Email IDs to archive'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft_send')

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      if (args.emailIds.length === 1) {
        await ctx.runAction(internal.arlo.gmailActions.modifyMessageLabels, {
          nangoConnectionId: result.integration.nangoConnectionId,
          messageId: args.emailIds[0],
          removeLabelIds: ['INBOX'],
        })
      } else {
        await ctx.runAction(internal.arlo.gmailActions.batchModifyLabels, {
          nangoConnectionId: result.integration.nangoConnectionId,
          messageIds: args.emailIds,
          removeLabelIds: ['INBOX'],
        })
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'archive_emails',
        actor: 'arlo',
        outcome: 'success',
        details: `Archived ${args.emailIds.length} email(s)`,
      })

      return {
        success: true,
        message: `Archived ${args.emailIds.length} email(s)`,
      }
    } catch (error) {
      console.error('Failed to archive:', error)
      return { success: false, error: 'Failed to archive emails' }
    }
  },
})

export const markAsRead = createTool({
  description: 'Mark emails as read',
  args: z.object({
    emailIds: z.array(z.string()).describe('Email IDs to mark as read'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft_send')

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      if (args.emailIds.length === 1) {
        await ctx.runAction(internal.arlo.gmailActions.modifyMessageLabels, {
          nangoConnectionId: result.integration.nangoConnectionId,
          messageId: args.emailIds[0],
          removeLabelIds: ['UNREAD'],
        })
      } else {
        await ctx.runAction(internal.arlo.gmailActions.batchModifyLabels, {
          nangoConnectionId: result.integration.nangoConnectionId,
          messageIds: args.emailIds,
          removeLabelIds: ['UNREAD'],
        })
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      return {
        success: true,
        message: `Marked ${args.emailIds.length} email(s) as read`,
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
      return { success: false, error: 'Failed to mark as read' }
    }
  },
})

export const createGmailLabel = createTool({
  description: 'Create a new custom Gmail label',
  args: z.object({
    name: z.string().describe('Label name'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft_send')

    if ('error' in result) {
      return { labelId: null, error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.gmailActions.createLabel, {
        nangoConnectionId: result.integration.nangoConnectionId,
        name: args.name,
      })) as { id: string; name: string }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      return {
        labelId: response.id,
        message: `Created label "${args.name}"`,
      }
    } catch (error) {
      console.error('Failed to create label:', error)
      return { labelId: null, error: 'Failed to create label' }
    }
  },
})

export const deleteGmailLabel = createTool({
  description: 'Delete a custom Gmail label (cannot delete system labels)',
  args: z.object({
    labelId: z.string().describe('Label ID to delete'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read_draft_send')

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      await ctx.runAction(internal.arlo.gmailActions.deleteLabel, {
        nangoConnectionId: result.integration.nangoConnectionId,
        labelId: args.labelId,
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      return { success: true, message: 'Label deleted' }
    } catch (error) {
      console.error('Failed to delete label:', error)
      return { success: false, error: 'Failed to delete label' }
    }
  },
})
