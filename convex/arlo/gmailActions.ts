'use node'

import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { getNangoClient } from '../lib/nango'
import { GMAIL_PROVIDER } from '../lib/integrationConstants'

// Types for Gmail API responses
interface GmailMessageHeader {
  name: string
  value: string
}

interface GmailMessagePart {
  mimeType: string
  body: { data?: string; size: number }
  parts?: GmailMessagePart[]
}

interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: GmailMessageHeader[]
    mimeType: string
    body: { data?: string; size: number }
    parts?: GmailMessagePart[]
  }
  internalDate: string
}

interface GmailThread {
  id: string
  messages: GmailMessage[]
}

// Helper: Parse email address from header
function parseEmailHeader(header: string): { name?: string; email: string } {
  const match = header.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/)
  if (match) {
    return { name: match[1]?.trim() || undefined, email: match[2] }
  }
  return { email: header }
}

// Helper: Get header value
function getHeader(headers: GmailMessageHeader[], name: string): string | undefined {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value
}

// Helper: Decode base64url
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

// Helper: Extract body from message parts
function extractBody(payload: GmailMessage['payload']): { text?: string; html?: string } {
  const result: { text?: string; html?: string } = {}

  function processPart(part: GmailMessagePart) {
    if (part.mimeType === 'text/plain' && part.body.data) {
      result.text = decodeBase64Url(part.body.data)
    } else if (part.mimeType === 'text/html' && part.body.data) {
      result.html = decodeBase64Url(part.body.data)
    } else if (part.parts) {
      part.parts.forEach(processPart)
    }
  }

  if (payload.body.data) {
    if (payload.mimeType === 'text/plain') {
      result.text = decodeBase64Url(payload.body.data)
    } else if (payload.mimeType === 'text/html') {
      result.html = decodeBase64Url(payload.body.data)
    }
  }

  if (payload.parts) {
    payload.parts.forEach(processPart)
  }

  return result
}

// Helper: Transform Gmail message to our format
function transformMessage(msg: GmailMessage) {
  const headers = msg.payload.headers
  const fromHeader = getHeader(headers, 'From') || ''
  const toHeader = getHeader(headers, 'To') || ''
  const body = extractBody(msg.payload)

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(headers, 'Subject') || '(no subject)',
    from: parseEmailHeader(fromHeader),
    to: toHeader.split(',').map((t) => parseEmailHeader(t.trim())),
    date: parseInt(msg.internalDate, 10),
    snippet: msg.snippet,
    body,
    labels: msg.labelIds || [],
  }
}

// List messages (returns IDs only, use getMessage for full content)
export const listMessages = internalAction({
  args: {
    nangoConnectionId: v.string(),
    query: v.optional(v.string()),
    maxResults: v.optional(v.number()),
    labelIds: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const params: Record<string, string> = {
      maxResults: String(args.maxResults || 20),
    }
    if (args.query) {
      params.q = args.query
    }
    if (args.labelIds?.length) {
      params.labelIds = args.labelIds.join(',')
    }

    const response = await nango.proxy({
      method: 'GET',
      endpoint: '/gmail/v1/users/me/messages',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      params,
    })

    const data = response.data as { messages?: Array<{ id: string; threadId: string }> }
    return { messages: data.messages || [] }
  },
})

// Get full message by ID
export const getMessage = internalAction({
  args: {
    nangoConnectionId: v.string(),
    messageId: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'GET',
      endpoint: `/gmail/v1/users/me/messages/${args.messageId}`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      params: { format: 'full' },
    })

    const msg = response.data as GmailMessage
    return { message: transformMessage(msg) }
  },
})

// Get thread with all messages
export const getThread = internalAction({
  args: {
    nangoConnectionId: v.string(),
    threadId: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'GET',
      endpoint: `/gmail/v1/users/me/threads/${args.threadId}`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      params: { format: 'full' },
    })

    const thread = response.data as GmailThread
    return {
      threadId: thread.id,
      messages: thread.messages.map(transformMessage),
    }
  },
})

// Search messages with Gmail query syntax
export const searchMessages = internalAction({
  args: {
    nangoConnectionId: v.string(),
    query: v.string(),
    maxResults: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'GET',
      endpoint: '/gmail/v1/users/me/messages',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      params: {
        q: args.query,
        maxResults: String(args.maxResults || 20),
      },
    })

    const data = response.data as { messages?: Array<{ id: string; threadId: string }> }

    // Fetch full messages for the results
    const messages = await Promise.all(
      (data.messages || []).slice(0, 10).map(async (m) => {
        const msgResponse = await nango.proxy({
          method: 'GET',
          endpoint: `/gmail/v1/users/me/messages/${m.id}`,
          connectionId: args.nangoConnectionId,
          providerConfigKey: GMAIL_PROVIDER,
          params: { format: 'full' },
        })
        return transformMessage(msgResponse.data as GmailMessage)
      })
    )

    return { messages }
  },
})

// Helper: Encode email to base64url format
function encodeEmail(options: {
  to: string[]
  subject: string
  body: string
  replyToMessageId?: string
  threadId?: string
}): string {
  let email = ''
  email += `To: ${options.to.join(', ')}\r\n`
  email += `Subject: ${options.subject}\r\n`
  email += `MIME-Version: 1.0\r\n`
  email += `Content-Type: text/plain; charset="UTF-8"\r\n`

  if (options.replyToMessageId) {
    email += `In-Reply-To: ${options.replyToMessageId}\r\n`
    email += `References: ${options.replyToMessageId}\r\n`
  }

  email += `\r\n`
  email += options.body

  return Buffer.from(email).toString('base64url')
}

// Create a draft
export const createDraft = internalAction({
  args: {
    nangoConnectionId: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    replyToMessageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const raw = encodeEmail({
      to: args.to,
      subject: args.subject,
      body: args.body,
      replyToMessageId: args.replyToMessageId,
      threadId: args.threadId,
    })

    const response = await nango.proxy({
      method: 'POST',
      endpoint: '/gmail/v1/users/me/drafts',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      data: {
        message: {
          raw,
          threadId: args.threadId,
        },
      },
    })

    const draft = response.data as { id: string; message: { id: string; threadId: string } }
    return {
      draftId: draft.id,
      messageId: draft.message.id,
      threadId: draft.message.threadId,
    }
  },
})

// Send a message directly
export const sendMessage = internalAction({
  args: {
    nangoConnectionId: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    replyToMessageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const raw = encodeEmail({
      to: args.to,
      subject: args.subject,
      body: args.body,
      replyToMessageId: args.replyToMessageId,
      threadId: args.threadId,
    })

    const response = await nango.proxy({
      method: 'POST',
      endpoint: '/gmail/v1/users/me/messages/send',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      data: {
        raw,
        threadId: args.threadId,
      },
    })

    const sent = response.data as { id: string; threadId: string; labelIds: string[] }
    return {
      messageId: sent.id,
      threadId: sent.threadId,
    }
  },
})

// Send an existing draft
export const sendDraft = internalAction({
  args: {
    nangoConnectionId: v.string(),
    draftId: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'POST',
      endpoint: `/gmail/v1/users/me/drafts/send`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      data: {
        id: args.draftId,
      },
    })

    const sent = response.data as { id: string; threadId: string; labelIds: string[] }
    return {
      messageId: sent.id,
      threadId: sent.threadId,
    }
  },
})

// Delete a draft
export const deleteDraft = internalAction({
  args: {
    nangoConnectionId: v.string(),
    draftId: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    await nango.proxy({
      method: 'DELETE',
      endpoint: `/gmail/v1/users/me/drafts/${args.draftId}`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
    })

    return { success: true }
  },
})

// Types for labels
interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  messageListVisibility?: 'show' | 'hide'
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
}

// List all labels
export const listLabels = internalAction({
  args: {
    nangoConnectionId: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'GET',
      endpoint: '/gmail/v1/users/me/labels',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
    })

    const data = response.data as { labels: GmailLabel[] }
    return {
      labels: data.labels.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
      })),
    }
  },
})

// Create a custom label
export const createLabel = internalAction({
  args: {
    nangoConnectionId: v.string(),
    name: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'POST',
      endpoint: '/gmail/v1/users/me/labels',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      data: {
        name: args.name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    })

    const label = response.data as GmailLabel
    return {
      id: label.id,
      name: label.name,
    }
  },
})

// Update a label
export const updateLabel = internalAction({
  args: {
    nangoConnectionId: v.string(),
    labelId: v.string(),
    name: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'PATCH',
      endpoint: `/gmail/v1/users/me/labels/${args.labelId}`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      data: {
        name: args.name,
      },
    })

    const label = response.data as GmailLabel
    return {
      id: label.id,
      name: label.name,
    }
  },
})

// Delete a label
export const deleteLabel = internalAction({
  args: {
    nangoConnectionId: v.string(),
    labelId: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    await nango.proxy({
      method: 'DELETE',
      endpoint: `/gmail/v1/users/me/labels/${args.labelId}`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
    })

    return { success: true }
  },
})

// Modify labels on a message
export const modifyMessageLabels = internalAction({
  args: {
    nangoConnectionId: v.string(),
    messageId: v.string(),
    addLabelIds: v.optional(v.array(v.string())),
    removeLabelIds: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    await nango.proxy({
      method: 'POST',
      endpoint: `/gmail/v1/users/me/messages/${args.messageId}/modify`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      data: {
        addLabelIds: args.addLabelIds || [],
        removeLabelIds: args.removeLabelIds || [],
      },
    })

    return { success: true }
  },
})

// Batch modify labels on multiple messages
export const batchModifyLabels = internalAction({
  args: {
    nangoConnectionId: v.string(),
    messageIds: v.array(v.string()),
    addLabelIds: v.optional(v.array(v.string())),
    removeLabelIds: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    await nango.proxy({
      method: 'POST',
      endpoint: '/gmail/v1/users/me/messages/batchModify',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GMAIL_PROVIDER,
      data: {
        ids: args.messageIds,
        addLabelIds: args.addLabelIds || [],
        removeLabelIds: args.removeLabelIds || [],
      },
    })

    return { success: true }
  },
})
