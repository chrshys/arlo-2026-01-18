# Gmail Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Gmail integration to Arlo via Nango, enabling email reading, drafting, sending, and label management with configurable permissions.

**Architecture:** Follow existing Nango integration pattern (Google Calendar). Actions in `gmailActions.ts` handle API calls via `nango.proxy()`. Tools in `tools/gmail.ts` expose capabilities to Arlo. Settings UI mirrors CalendarSelector pattern with permission level dropdown and confirmation toggle.

**Tech Stack:** Convex (actions, mutations, tools), Nango SDK, React/Next.js, Tailwind CSS, Zod for validation

**Design doc:** `docs/plans/2026-01-20-gmail-integration-design.md`

---

## Task 1: Create Branch and Add Constants

**Files:**

- Modify: `convex/lib/integrationConstants.ts`

**Step 1: Create feature branch**

```bash
git checkout -b feat/gmail-integration
```

**Step 2: Add Gmail constants**

Add to `convex/lib/integrationConstants.ts`:

```typescript
export const GMAIL_PROVIDER = 'gmail'

// Scopes for each permission level
export const GMAIL_SCOPES_READ = ['https://www.googleapis.com/auth/gmail.readonly']

export const GMAIL_SCOPES_READ_DRAFT = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
]

export const GMAIL_SCOPES_FULL = ['https://www.googleapis.com/auth/gmail.modify']
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 4: Commit**

```bash
git add convex/lib/integrationConstants.ts
git commit -m "feat(gmail): add Gmail provider constants and scopes"
```

---

## Task 2: Update Schema

**Files:**

- Modify: `convex/schema.ts`

**Step 1: Add Gmail-specific fields to integrations table**

In `convex/schema.ts`, update the `integrations` table definition to add after `enabledCalendarIds`:

```typescript
  integrations: defineTable({
    userId: v.id('users'),
    provider: v.string(),
    nangoConnectionId: v.string(),
    status: v.union(v.literal('active'), v.literal('expired'), v.literal('revoked')),
    scopes: v.array(v.string()),
    connectedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    enabledCalendarIds: v.optional(v.array(v.string())),
    // Gmail-specific settings
    gmailPermissionLevel: v.optional(
      v.union(v.literal('read'), v.literal('read_draft'), v.literal('read_draft_send'))
    ),
    gmailRequireConfirmation: v.optional(v.boolean()),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_provider', ['userId', 'provider'])
    .index('by_nango_connection', ['nangoConnectionId']),
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(gmail): add Gmail permission fields to schema"
```

---

## Task 3: Update Integrations Mutations

**Files:**

- Modify: `convex/integrations.ts`

**Step 1: Import Gmail constants**

Add to imports at top of `convex/integrations.ts`:

```typescript
import {
  GOOGLE_CALENDAR_PROVIDER,
  GOOGLE_CALENDAR_SCOPES,
  GMAIL_PROVIDER,
  GMAIL_SCOPES_READ_DRAFT,
} from './lib/integrationConstants'
```

**Step 2: Update saveConnection mutation**

Update the scopes assignment in `saveConnection` handler:

```typescript
// Create new integration
let scopes: string[] = []
if (args.provider === GOOGLE_CALENDAR_PROVIDER) {
  scopes = GOOGLE_CALENDAR_SCOPES
} else if (args.provider === GMAIL_PROVIDER) {
  scopes = GMAIL_SCOPES_READ_DRAFT
}

// Gmail-specific defaults
const gmailDefaults =
  args.provider === GMAIL_PROVIDER
    ? {
        gmailPermissionLevel: 'read_draft' as const,
        gmailRequireConfirmation: true,
      }
    : {}

return ctx.db.insert('integrations', {
  userId: user._id,
  provider: args.provider,
  nangoConnectionId: args.nangoConnectionId,
  status: 'active',
  scopes,
  connectedAt: Date.now(),
  ...gmailDefaults,
})
```

**Step 3: Add Gmail settings mutation**

Add after `setCalendarEnabled` mutation:

```typescript
// Mutation: Update Gmail permission settings
export const setGmailSettings = mutation({
  args: {
    permissionLevel: v.union(
      v.literal('read'),
      v.literal('read_draft'),
      v.literal('read_draft_send')
    ),
    requireConfirmation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', user._id).eq('provider', GMAIL_PROVIDER)
      )
      .first()

    if (!integration) {
      throw new Error('Gmail not connected')
    }

    const updates: Record<string, unknown> = {
      gmailPermissionLevel: args.permissionLevel,
    }

    // Only set confirmation if permission level includes send
    if (args.permissionLevel === 'read_draft_send' && args.requireConfirmation !== undefined) {
      updates.gmailRequireConfirmation = args.requireConfirmation
    }

    await ctx.db.patch(integration._id, updates)

    return { success: true }
  },
})
```

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 5: Commit**

```bash
git add convex/integrations.ts
git commit -m "feat(gmail): add Gmail settings mutation and update saveConnection"
```

---

## Task 4: Create Gmail Actions - Message Operations

**Files:**

- Create: `convex/arlo/gmailActions.ts`

**Step 1: Create gmailActions.ts with message operations**

Create `convex/arlo/gmailActions.ts`:

```typescript
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
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add convex/arlo/gmailActions.ts
git commit -m "feat(gmail): add Gmail message actions (list, get, search, thread)"
```

---

## Task 5: Add Draft and Send Operations to Gmail Actions

**Files:**

- Modify: `convex/arlo/gmailActions.ts`

**Step 1: Add draft and send operations**

Add to end of `convex/arlo/gmailActions.ts`:

```typescript
// Helper: Encode email to base64url format
function encodeEmail(options: {
  to: string[]
  subject: string
  body: string
  replyToMessageId?: string
  threadId?: string
}): string {
  const boundary = '----=_Part_' + Math.random().toString(36).substring(2)

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
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add convex/arlo/gmailActions.ts
git commit -m "feat(gmail): add draft and send actions"
```

---

## Task 6: Add Label Operations to Gmail Actions

**Files:**

- Modify: `convex/arlo/gmailActions.ts`

**Step 1: Add label operations**

Add to end of `convex/arlo/gmailActions.ts`:

```typescript
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
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add convex/arlo/gmailActions.ts
git commit -m "feat(gmail): add label actions (list, create, update, delete, modify)"
```

---

## Task 7: Create Gmail Tools - Helper Functions

**Files:**

- Create: `convex/arlo/tools/gmail.ts`

**Step 1: Create gmail.ts with helper functions**

Create `convex/arlo/tools/gmail.ts`:

```typescript
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
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add convex/arlo/tools/gmail.ts
git commit -m "feat(gmail): add Gmail tools helper functions"
```

---

## Task 8: Add Reading Tools

**Files:**

- Modify: `convex/arlo/tools/gmail.ts`

**Step 1: Add reading tools**

Add to end of `convex/arlo/tools/gmail.ts`:

```typescript
import { createTool } from '@convex-dev/agent'
import { z } from 'zod'

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
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add convex/arlo/tools/gmail.ts
git commit -m "feat(gmail): add reading tools (search, get, thread, summarize)"
```

---

## Task 9: Add Composing Tools

**Files:**

- Modify: `convex/arlo/tools/gmail.ts`

**Step 1: Add composing tools**

Add to end of `convex/arlo/tools/gmail.ts`:

```typescript
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
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add convex/arlo/tools/gmail.ts
git commit -m "feat(gmail): add composing tools (createDraft, sendEmail, sendDraft, deleteDraft)"
```

---

## Task 10: Add Organization Tools

**Files:**

- Modify: `convex/arlo/tools/gmail.ts`

**Step 1: Add organization tools**

Add to end of `convex/arlo/tools/gmail.ts`:

```typescript
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
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add convex/arlo/tools/gmail.ts
git commit -m "feat(gmail): add organization tools (labels, archive, markAsRead)"
```

---

## Task 11: Add Task Integration Tool

**Files:**

- Modify: `convex/arlo/tools/gmail.ts`

**Step 1: Add createTaskFromEmail tool**

Add to end of `convex/arlo/tools/gmail.ts`:

```typescript
export const createTaskFromEmail = createTool({
  description: 'Create a task from an email, linking back to the email for reference',
  args: z.object({
    emailId: z.string().describe('Email ID to create task from'),
    taskTitle: z.string().describe('Title for the task'),
    taskDescription: z.string().optional().describe('Additional task description'),
    priority: z.enum(['none', 'low', 'medium', 'high']).optional().describe('Task priority'),
    dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getGmailConnection(ctx, userId, 'read')

    if ('error' in result) {
      return { taskId: null, error: result.error }
    }

    try {
      // Get email details for context
      const emailResponse = (await ctx.runAction(internal.arlo.gmailActions.getMessage, {
        nangoConnectionId: result.integration.nangoConnectionId,
        messageId: args.emailId,
      })) as {
        message: {
          id: string
          subject: string
          from: { name?: string; email: string }
          snippet: string
        }
      }

      const email = emailResponse.message
      const fromStr = email.from.name
        ? `${email.from.name} <${email.from.email}>`
        : email.from.email

      // Build description with email reference
      const description = [
        args.taskDescription,
        '',
        '---',
        `**From email:** "${email.subject}"`,
        `**From:** ${fromStr}`,
        `**Email ID:** ${email.id}`,
      ]
        .filter(Boolean)
        .join('\n')

      // Create the task
      const taskResponse = (await ctx.runMutation(internal.tasks.createInternal, {
        userId,
        title: args.taskTitle,
        description,
        priority: args.priority || 'none',
        dueDate: args.dueDate ? new Date(args.dueDate).getTime() : undefined,
        createdBy: 'arlo',
      })) as { _id: string }

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'create_task_from_email',
        actor: 'arlo',
        outcome: 'success',
        targetId: taskResponse._id,
        details: `Created task "${args.taskTitle}" from email "${email.subject}"`,
      })

      return {
        taskId: taskResponse._id,
        message: `Created task "${args.taskTitle}" from email`,
      }
    } catch (error) {
      console.error('Failed to create task from email:', error)
      return { taskId: null, error: 'Failed to create task from email' }
    }
  },
})
```

**Step 2: Add internal task creation mutation**

In `convex/tasks.ts`, add this internal mutation (if not already present):

```typescript
import { internalMutation } from './_generated/server'

// Internal mutation for creating tasks from other tools
export const createInternal = internalMutation({
  args: {
    userId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal('none'), v.literal('low'), v.literal('medium'), v.literal('high'))
    ),
    dueDate: v.optional(v.number()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('tasks', {
      userId: args.userId,
      title: args.title,
      description: args.description,
      status: 'pending',
      priority: args.priority || 'none',
      dueDate: args.dueDate,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    })
  },
})
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 4: Commit**

```bash
git add convex/arlo/tools/gmail.ts convex/tasks.ts
git commit -m "feat(gmail): add createTaskFromEmail tool"
```

---

## Task 12: Register Gmail Tools in Agent

**Files:**

- Modify: `convex/arlo/agent.ts`

**Step 1: Import Gmail tools**

Update imports in `convex/arlo/agent.ts`:

```typescript
import {
  searchEmails,
  getEmail,
  getEmailThread,
  summarizeInbox,
  createDraft,
  sendEmail,
  sendDraft,
  deleteDraft,
  listLabels,
  applyLabel,
  removeLabel,
  archiveEmail,
  markAsRead,
  createGmailLabel,
  deleteGmailLabel,
  createTaskFromEmail,
} from './tools/gmail'
```

**Step 2: Add tools to agent**

In the `tools` object, add the Gmail tools:

```typescript
  tools: {
    // Existing task tools
    createTask,
    listTasks,
    completeTask,
    moveTask,
    setReminder,
    listProjects,
    setTaskPriority,
    setDueDate,
    createNote,
    listNotes,
    updateNote,
    // Calendar tools
    listAccessibleCalendars,
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    checkCalendarAvailability,
    // Gmail tools
    searchEmails,
    getEmail,
    getEmailThread,
    summarizeInbox,
    createDraft,
    sendEmail,
    sendDraft,
    deleteDraft,
    listLabels,
    applyLabel,
    removeLabel,
    archiveEmail,
    markAsRead,
    createGmailLabel,
    deleteGmailLabel,
    createTaskFromEmail,
  },
```

**Step 3: Update system prompt**

Add Gmail instructions to the agent's `instructions`:

```typescript
  instructions: `You are Arlo, a personal assistant who shares a task and notes workspace with the user.

... (existing task/note/calendar instructions) ...

You have access to Gmail (if the user has connected it):
- Search and read emails
- Get full email content or entire threads
- Summarize unread inbox
- Create draft emails
- Send emails (may require confirmation based on settings)
- Manage labels (list, create, apply, remove)
- Archive emails, mark as read
- Create tasks from emails

When handling email requests:
- If sending requires confirmation, create a draft and ask the user to confirm
- When user says "send it" or "confirm", use sendDraft with the draft ID
- When user says "cancel" or "don't send", use deleteDraft
- Permission levels control what's available - share any permission errors with the user

If Gmail isn't connected, the tool will return an error message - share that with the user.

... (rest of existing instructions) ...`,
```

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 5: Commit**

```bash
git add convex/arlo/agent.ts
git commit -m "feat(gmail): register Gmail tools in Arlo agent"
```

---

## Task 13: Create Gmail Settings UI Component

**Files:**

- Create: `components/integrations/GmailSettings.tsx`

**Step 1: Create GmailSettings component**

Create `components/integrations/GmailSettings.tsx`:

```typescript
'use client'

import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Mail } from 'lucide-react'

interface GmailSettingsProps {
  isConnected: boolean
}

type PermissionLevel = 'read' | 'read_draft' | 'read_draft_send'

const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  read: 'Read-only',
  read_draft: 'Read + Draft',
  read_draft_send: 'Read + Draft + Send',
}

const PERMISSION_DESCRIPTIONS: Record<PermissionLevel, string> = {
  read: 'Search and read emails only',
  read_draft: 'Read emails and create drafts',
  read_draft_send: 'Full access including sending',
}

export function GmailSettings({ isConnected }: GmailSettingsProps) {
  const integration = useQuery(
    api.integrations.getByProvider,
    isConnected ? { provider: 'gmail' } : 'skip'
  )
  const setGmailSettings = useMutation(api.integrations.setGmailSettings)

  const [isExpanded, setIsExpanded] = useState(false)
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('read_draft')
  const [requireConfirmation, setRequireConfirmation] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (integration) {
      setPermissionLevel(integration.gmailPermissionLevel || 'read_draft')
      setRequireConfirmation(integration.gmailRequireConfirmation !== false)
    }
  }, [integration])

  const handlePermissionChange = async (level: PermissionLevel) => {
    setPermissionLevel(level)
    setSaving(true)
    try {
      await setGmailSettings({
        permissionLevel: level,
        requireConfirmation: level === 'read_draft_send' ? requireConfirmation : undefined,
      })
    } catch (error) {
      console.error('Failed to update settings:', error)
      // Revert on error
      setPermissionLevel(integration?.gmailPermissionLevel || 'read_draft')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmationChange = async (checked: boolean) => {
    setRequireConfirmation(checked)
    setSaving(true)
    try {
      await setGmailSettings({
        permissionLevel,
        requireConfirmation: checked,
      })
    } catch (error) {
      console.error('Failed to update settings:', error)
      setRequireConfirmation(!checked)
    } finally {
      setSaving(false)
    }
  }

  if (!isConnected) return null

  return (
    <div className="mt-4 border-t pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Gmail Settings</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {PERMISSION_LABELS[permissionLevel]}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {/* Permission Level */}
          <div>
            <label className="block text-sm font-medium mb-2">Permission level</label>
            <div className="grid gap-2">
              {(Object.keys(PERMISSION_LABELS) as PermissionLevel[]).map((level) => (
                <label
                  key={level}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                    permissionLevel === level
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-transparent hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="permissionLevel"
                    checked={permissionLevel === level}
                    onChange={() => handlePermissionChange(level)}
                    disabled={saving}
                    className="h-4 w-4"
                  />
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{PERMISSION_LABELS[level]}</span>
                    <p className="text-xs text-muted-foreground">
                      {PERMISSION_DESCRIPTIONS[level]}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Confirmation Toggle (only for send permission) */}
          {permissionLevel === 'read_draft_send' && (
            <div className="rounded-md border border-border p-3">
              <label className="flex cursor-pointer items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Require confirmation before sending</span>
                  <p className="text-xs text-muted-foreground">
                    Arlo will create a draft and ask for approval before sending
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={requireConfirmation}
                  onChange={(e) => handleConfirmationChange(e.target.checked)}
                  disabled={saving}
                  className="h-4 w-4 rounded border-border"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add components/integrations/GmailSettings.tsx
git commit -m "feat(gmail): add GmailSettings UI component"
```

---

## Task 14: Update IntegrationCard for Gmail

**Files:**

- Modify: `components/integrations/IntegrationCard.tsx`

**Step 1: Import GmailSettings**

Add import:

```typescript
import { GmailSettings } from './GmailSettings'
```

**Step 2: Add Gmail condition**

Update the component to render GmailSettings:

```typescript
export function IntegrationCard({
  provider,
  name,
  description,
  icon,
  status,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const isConnected = status === 'connected'
  const needsReconnect = status === 'expired' || status === 'revoked'
  const isGoogleCalendar = provider === 'google-calendar'
  const isGmail = provider === 'gmail'

  return (
    <div className="rounded-lg border border-border p-4">
      {/* ... existing card content ... */}

      {isGoogleCalendar && <CalendarSelector isConnected={isConnected} />}
      {isGmail && <GmailSettings isConnected={isConnected} />}
    </div>
  )
}
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 4: Commit**

```bash
git add components/integrations/IntegrationCard.tsx
git commit -m "feat(gmail): integrate GmailSettings into IntegrationCard"
```

---

## Task 15: Add Gmail to Settings Page

**Files:**

- Modify: `app/settings/integrations/page.tsx`

**Step 1: Add Gmail to AVAILABLE_INTEGRATIONS**

Update the array:

```typescript
const AVAILABLE_INTEGRATIONS = [
  {
    provider: 'google-calendar',
    name: 'Google Calendar',
    description: 'Read and manage calendar events',
    icon: '📅',
  },
  {
    provider: 'gmail',
    name: 'Gmail',
    description: 'Read, draft, and send emails',
    icon: '📧',
  },
]
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/settings/integrations/page.tsx
git commit -m "feat(gmail): add Gmail to integrations settings page"
```

---

## Task 16: Run Full Check and Final Commit

**Step 1: Run full check**

```bash
pnpm check
```

Expected: No errors from typecheck, lint, or format

**Step 2: Fix any issues**

If lint issues, run:

```bash
pnpm lint:fix && pnpm format
```

**Step 3: Run tests**

```bash
pnpm test:run
```

Expected: All tests pass

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore: fix lint and format issues"
```

---

## Task 17: Nango Dashboard Setup (Manual)

**This task is manual - not automated**

1. Log into Nango dashboard
2. Create new integration:
   - Provider: Google
   - Integration name: `gmail`
   - OAuth scopes: `https://www.googleapis.com/auth/gmail.modify`
3. Configure OAuth consent screen in Google Cloud Console if needed
4. Copy webhook URL from Nango and ensure it points to:
   - `https://<your-convex-deployment>.convex.site/webhooks/nango`
5. Test the OAuth flow manually

---

## Summary

**Files created:**

- `convex/arlo/gmailActions.ts` — Gmail API actions via Nango
- `convex/arlo/tools/gmail.ts` — Arlo tools for email operations
- `components/integrations/GmailSettings.tsx` — Settings UI

**Files modified:**

- `convex/lib/integrationConstants.ts` — Gmail constants
- `convex/schema.ts` — Gmail permission fields
- `convex/integrations.ts` — Gmail settings mutations
- `convex/tasks.ts` — Internal task creation mutation
- `convex/arlo/agent.ts` — Gmail tools registration
- `components/integrations/IntegrationCard.tsx` — Gmail settings rendering
- `app/settings/integrations/page.tsx` — Gmail in available integrations

**Total commits:** ~16 focused commits following the implementation progression
