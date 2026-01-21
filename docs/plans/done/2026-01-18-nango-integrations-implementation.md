# Nango Integrations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Google Calendar via Nango, enabling Arlo to read/create/update/delete calendar events.

**Architecture:** Nango handles OAuth token lifecycle. We store only `nangoConnectionId` in Convex. Convex actions create Nango sessions and make API calls via Nango's proxy. Webhooks handle token expiry/revocation.

**Tech Stack:** Nango (`@nangohq/node`, `@nangohq/frontend`), Convex (actions, webhooks), Next.js (settings UI)

---

## Prerequisites (Manual Steps)

Before starting, complete these in your Nango dashboard:

1. Create Nango account at https://nango.dev
2. Create a Google Calendar integration with scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
3. Get your `NANGO_SECRET_KEY` from Nango dashboard
4. Set up webhook in Nango dashboard pointing to `https://<your-deployment>.convex.site/webhooks/nango`
5. Get your `NANGO_WEBHOOK_SECRET` from webhook settings

Then set Convex environment variables:

```bash
npx convex env set NANGO_SECRET_KEY "<your-secret-key>"
npx convex env set NANGO_WEBHOOK_SECRET "<your-webhook-secret>"
```

---

## Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install Nango packages**

Run:

```bash
pnpm add @nangohq/node @nangohq/frontend
```

**Step 2: Verify installation**

Run: `pnpm list @nangohq/node @nangohq/frontend`
Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add nango dependencies"
```

---

## Task 2: Add Integrations Table to Schema

**Files:**

- Modify: `convex/schema.ts:106` (after activity table)

**Step 1: Add the integrations table definition**

Add after the `activity` table definition (before the closing `})`):

```typescript
  integrations: defineTable({
    userId: v.id('users'),
    provider: v.string(),
    nangoConnectionId: v.string(),
    status: v.union(v.literal('active'), v.literal('expired'), v.literal('revoked')),
    scopes: v.array(v.string()),
    connectedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_provider', ['userId', 'provider'])
    .index('by_nango_connection', ['nangoConnectionId']),
```

**Step 2: Run Convex dev to push schema**

Run: `npx convex dev --once`
Expected: Schema pushed successfully

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add integrations table to schema"
```

---

## Task 3: Create Nango Client Wrapper

**Files:**

- Create: `convex/lib/nango.ts`

**Step 1: Create the Nango client wrapper**

```typescript
import { Nango } from '@nangohq/node'

let nangoClient: Nango | null = null

export function getNangoClient(): Nango {
  if (!nangoClient) {
    const secretKey = process.env.NANGO_SECRET_KEY
    if (!secretKey) {
      throw new Error('NANGO_SECRET_KEY environment variable is not set')
    }
    nangoClient = new Nango({ secretKey })
  }
  return nangoClient
}

export const GOOGLE_CALENDAR_PROVIDER = 'google-calendar'

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
]
```

**Step 2: Verify file exists**

Run: `ls -la convex/lib/nango.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add convex/lib/nango.ts
git commit -m "feat: add Nango client wrapper"
```

---

## Task 4: Create Integrations Convex Functions

**Files:**

- Create: `convex/integrations.ts`

**Step 1: Create the integrations file with queries, mutations, and actions**

```typescript
import { v } from 'convex/values'
import { query, mutation, action, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { getNangoClient, GOOGLE_CALENDAR_PROVIDER, GOOGLE_CALENDAR_SCOPES } from './lib/nango'
import { requireCurrentUser, getCurrentUserFromAction } from './lib/auth'

// Query: Get user's integrations
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return ctx.db
      .query('integrations')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})

// Query: Get a specific integration by provider
export const getByProvider = query({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    return ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', user._id).eq('provider', args.provider)
      )
      .first()
  },
})

// Action: Create a Nango session for OAuth
export const createSession = action({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const { clerkId } = await getCurrentUserFromAction(ctx)
    const nango = getNangoClient()

    const session = await nango.auth.createConnectSession({
      end_user: {
        id: clerkId,
        email: undefined,
        display_name: undefined,
      },
      allowed_integrations: [args.provider],
    })

    return { sessionToken: session.token }
  },
})

// Mutation: Save a new integration after OAuth completes
export const saveConnection = mutation({
  args: {
    provider: v.string(),
    nangoConnectionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Check if integration already exists
    const existing = await ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', user._id).eq('provider', args.provider)
      )
      .first()

    if (existing) {
      // Update existing integration
      await ctx.db.patch(existing._id, {
        nangoConnectionId: args.nangoConnectionId,
        status: 'active',
        connectedAt: Date.now(),
      })
      return existing._id
    }

    // Create new integration
    const scopes = args.provider === GOOGLE_CALENDAR_PROVIDER ? GOOGLE_CALENDAR_SCOPES : []

    return ctx.db.insert('integrations', {
      userId: user._id,
      provider: args.provider,
      nangoConnectionId: args.nangoConnectionId,
      status: 'active',
      scopes,
      connectedAt: Date.now(),
    })
  },
})

// Mutation: Disconnect an integration
export const disconnect = mutation({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', user._id).eq('provider', args.provider)
      )
      .first()

    if (integration) {
      await ctx.db.delete(integration._id)
    }
  },
})

// Internal mutation: Handle webhook events
export const handleWebhookEvent = internalMutation({
  args: {
    type: v.string(),
    connectionId: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_nango_connection', (q) => q.eq('nangoConnectionId', args.connectionId))
      .first()

    if (!integration) {
      // Connection not in our system (might be initial creation)
      return
    }

    switch (args.type) {
      case 'auth.refresh_error':
        await ctx.db.patch(integration._id, { status: 'expired' })
        break
      case 'auth.revoked':
        await ctx.db.patch(integration._id, { status: 'revoked' })
        break
    }
  },
})

// Internal mutation: Update lastUsedAt timestamp
export const updateLastUsed = internalMutation({
  args: { integrationId: v.id('integrations') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, { lastUsedAt: Date.now() })
  },
})
```

**Step 2: Verify no type errors**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add convex/integrations.ts
git commit -m "feat: add integrations queries, mutations, and actions"
```

---

## Task 5: Add Nango Webhook Handler

**Files:**

- Modify: `convex/http.ts`

**Step 1: Add Nango webhook types and route**

Add after the Clerk webhook route (before `export default http`):

```typescript
// Nango webhook types
interface NangoWebhookPayload {
  type: string
  connectionId: string
  providerConfigKey?: string
}

http.route({
  path: '/webhooks/nango',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.NANGO_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('NANGO_WEBHOOK_SECRET not set')
      return new Response('Webhook secret not configured', { status: 500 })
    }

    // Verify signature
    const signature = request.headers.get('x-nango-signature')
    if (!signature) {
      return new Response('Missing signature header', { status: 400 })
    }

    const payload = await request.text()

    // Verify HMAC signature
    const crypto = await import('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex')

    if (signature !== expectedSignature) {
      console.error('Webhook signature mismatch')
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(payload) as NangoWebhookPayload

    // Handle event
    await ctx.runMutation(internal.integrations.handleWebhookEvent, {
      type: event.type,
      connectionId: event.connectionId,
      provider: event.providerConfigKey,
    })

    return new Response('OK', { status: 200 })
  }),
})
```

**Step 2: Verify no type errors**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add convex/http.ts
git commit -m "feat: add Nango webhook handler"
```

---

## Task 6: Create Integrations Settings Page

**Files:**

- Modify: `app/settings/layout.tsx` (add nav item)
- Create: `app/settings/integrations/page.tsx`
- Create: `components/integrations/IntegrationCard.tsx`
- Create: `components/integrations/NangoConnectButton.tsx`

**Step 1: Add Integrations nav item to settings layout**

In `app/settings/layout.tsx`, update the `navItems` array:

```typescript
const navItems = [
  { href: '/settings/activity', label: 'Activity' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/appearance', label: 'Appearance' },
]
```

**Step 2: Create IntegrationCard component**

Create `components/integrations/IntegrationCard.tsx`:

```tsx
'use client'

import { NangoConnectButton } from './NangoConnectButton'

interface IntegrationCardProps {
  provider: string
  name: string
  description: string
  icon: React.ReactNode
  status: 'connected' | 'disconnected' | 'expired' | 'revoked'
  onConnect: (connectionId: string) => void
  onDisconnect: () => void
}

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

  return (
    <div className="border border-border rounded-lg p-4 flex items-start gap-4">
      <div className="text-2xl">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{name}</h3>
          {isConnected && (
            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
              Connected
            </span>
          )}
          {needsReconnect && (
            <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded">
              {status === 'expired' ? 'Expired' : 'Revoked'}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div>
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Disconnect
          </button>
        ) : (
          <NangoConnectButton
            provider={provider}
            onSuccess={onConnect}
            label={needsReconnect ? 'Reconnect' : 'Connect'}
          />
        )}
      </div>
    </div>
  )
}
```

**Step 3: Create NangoConnectButton component**

Create `components/integrations/NangoConnectButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'

interface NangoConnectButtonProps {
  provider: string
  onSuccess: (connectionId: string) => void
  label?: string
}

export function NangoConnectButton({
  provider,
  onSuccess,
  label = 'Connect',
}: NangoConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const createSession = useAction(api.integrations.createSession)

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      const { sessionToken } = await createSession({ provider })

      // Dynamically import Nango frontend SDK
      const { default: Nango } = await import('@nangohq/frontend')
      const nango = new Nango()

      const result = await nango.auth(provider, {
        sessionToken,
      })

      if (result.connectionId) {
        onSuccess(result.connectionId)
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
    >
      {isLoading ? 'Connecting...' : label}
    </button>
  )
}
```

**Step 4: Create integrations settings page**

Create `app/settings/integrations/page.tsx`:

```tsx
'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'

const AVAILABLE_INTEGRATIONS = [
  {
    provider: 'google-calendar',
    name: 'Google Calendar',
    description: 'Read and manage calendar events',
    icon: '📅',
  },
]

export default function IntegrationsPage() {
  const integrations = useQuery(api.integrations.list)
  const saveConnection = useMutation(api.integrations.saveConnection)
  const disconnect = useMutation(api.integrations.disconnect)

  const getStatus = (provider: string) => {
    const integration = integrations?.find((i) => i.provider === provider)
    if (!integration) return 'disconnected'
    return integration.status === 'active' ? 'connected' : integration.status
  }

  const handleConnect = async (provider: string, connectionId: string) => {
    await saveConnection({ provider, nangoConnectionId: connectionId })
  }

  const handleDisconnect = async (provider: string) => {
    await disconnect({ provider })
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Integrations</h1>
      <p className="text-muted-foreground mb-6">
        Connect external services to let Arlo access your calendar, email, and more.
      </p>

      <div className="space-y-4">
        {AVAILABLE_INTEGRATIONS.map((integration) => (
          <IntegrationCard
            key={integration.provider}
            provider={integration.provider}
            name={integration.name}
            description={integration.description}
            icon={integration.icon}
            status={
              getStatus(integration.provider) as
                | 'connected'
                | 'disconnected'
                | 'expired'
                | 'revoked'
            }
            onConnect={(connectionId) => handleConnect(integration.provider, connectionId)}
            onDisconnect={() => handleDisconnect(integration.provider)}
          />
        ))}
      </div>
    </div>
  )
}
```

**Step 5: Verify no type errors**

Run: `pnpm typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add app/settings/layout.tsx app/settings/integrations/page.tsx components/integrations/
git commit -m "feat: add integrations settings page with Google Calendar"
```

---

## Task 7: Create Calendar Tools for Arlo

**Files:**

- Create: `convex/arlo/tools/calendar.ts`
- Modify: `convex/arlo/agent.ts` (register tools)

**Step 1: Create calendar tools file**

Create `convex/arlo/tools/calendar.ts`:

```typescript
import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../../_generated/api'
import { Id } from '../../_generated/dataModel'
import { getNangoClient, GOOGLE_CALENDAR_PROVIDER } from '../../lib/nango'

function getUserId(ctx: { userId?: string }): Id<'users'> {
  if (!ctx.userId) {
    throw new Error('User context not available')
  }
  return ctx.userId as Id<'users'>
}

async function getCalendarConnection(
  ctx: { runQuery: (fn: unknown, args: unknown) => Promise<unknown> },
  userId: Id<'users'>
) {
  const integration = await ctx.runQuery(internal.integrations.getByUserIdAndProvider, {
    userId,
    provider: GOOGLE_CALENDAR_PROVIDER,
  })

  if (!integration) {
    return {
      error: 'Google Calendar is not connected. Please connect it in Settings → Integrations.',
    }
  }

  if (integration.status !== 'active') {
    return {
      error: 'Google Calendar connection has expired. Please reconnect in Settings → Integrations.',
    }
  }

  return { integration }
}

export const getCalendarEvents = createTool({
  description: 'Get upcoming calendar events from Google Calendar',
  args: z.object({
    startDate: z.string().optional().describe('Start date in ISO format (defaults to now)'),
    endDate: z.string().optional().describe('End date in ISO format (defaults to 7 days from now)'),
    query: z.string().optional().describe('Search query to filter events'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { events: [], error: result.error }
    }

    const nango = getNangoClient()
    const now = new Date()
    const timeMin = args.startDate || now.toISOString()
    const timeMax = args.endDate || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    try {
      const response = await nango.proxy({
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
        params: {
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          q: args.query,
        },
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'get_calendar_events',
        actor: 'arlo',
        outcome: 'success',
        details: `Retrieved calendar events`,
      })

      const events =
        (
          response.data as {
            items?: Array<{
              id: string
              summary: string
              start: { dateTime?: string; date?: string }
              end: { dateTime?: string; date?: string }
              location?: string
              description?: string
            }>
          }
        ).items || []

      return {
        events: events.map((e) => ({
          id: e.id,
          title: e.summary,
          start: e.start.dateTime || e.start.date,
          end: e.end.dateTime || e.end.date,
          location: e.location,
          description: e.description,
        })),
      }
    } catch (error) {
      console.error('Failed to get calendar events:', error)
      return { events: [], error: 'Failed to retrieve calendar events' }
    }
  },
})

export const createCalendarEvent = createTool({
  description: 'Create a new event in Google Calendar',
  args: z.object({
    title: z.string().describe('Event title'),
    startTime: z.string().describe('Start time in ISO format'),
    endTime: z.string().describe('End time in ISO format'),
    description: z.string().optional().describe('Event description'),
    location: z.string().optional().describe('Event location'),
    attendees: z.array(z.string()).optional().describe('List of attendee emails'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { eventId: null, error: result.error }
    }

    const nango = getNangoClient()

    try {
      const response = await nango.proxy({
        method: 'POST',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
        data: {
          summary: args.title,
          start: { dateTime: args.startTime },
          end: { dateTime: args.endTime },
          description: args.description,
          location: args.location,
          attendees: args.attendees?.map((email) => ({ email })),
        },
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'create_calendar_event',
        actor: 'arlo',
        outcome: 'success',
        details: `Created calendar event: ${args.title}`,
      })

      return {
        eventId: (response.data as { id: string }).id,
        message: `Created calendar event: "${args.title}"`,
      }
    } catch (error) {
      console.error('Failed to create calendar event:', error)
      return { eventId: null, error: 'Failed to create calendar event' }
    }
  },
})

export const updateCalendarEvent = createTool({
  description: 'Update an existing calendar event',
  args: z.object({
    eventId: z.string().describe('The ID of the event to update'),
    title: z.string().optional().describe('New event title'),
    startTime: z.string().optional().describe('New start time in ISO format'),
    endTime: z.string().optional().describe('New end time in ISO format'),
    description: z.string().optional().describe('New event description'),
    location: z.string().optional().describe('New event location'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    const nango = getNangoClient()

    try {
      const updateData: Record<string, unknown> = {}
      if (args.title) updateData.summary = args.title
      if (args.startTime) updateData.start = { dateTime: args.startTime }
      if (args.endTime) updateData.end = { dateTime: args.endTime }
      if (args.description) updateData.description = args.description
      if (args.location) updateData.location = args.location

      await nango.proxy({
        method: 'PATCH',
        endpoint: `/calendar/v3/calendars/primary/events/${args.eventId}`,
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
        data: updateData,
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'update_calendar_event',
        actor: 'arlo',
        outcome: 'success',
        targetId: args.eventId,
        details: 'Updated calendar event',
      })

      return { success: true, message: 'Calendar event updated' }
    } catch (error) {
      console.error('Failed to update calendar event:', error)
      return { success: false, error: 'Failed to update calendar event' }
    }
  },
})

export const deleteCalendarEvent = createTool({
  description: 'Delete a calendar event. Use with caution - this is permanent.',
  args: z.object({
    eventId: z.string().describe('The ID of the event to delete'),
    confirmed: z.boolean().describe('Set to true to confirm deletion'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)

    if (!args.confirmed) {
      return {
        success: false,
        message: 'Please confirm you want to delete this event by setting confirmed: true',
      }
    }

    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    const nango = getNangoClient()

    try {
      await nango.proxy({
        method: 'DELETE',
        endpoint: `/calendar/v3/calendars/primary/events/${args.eventId}`,
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'delete_calendar_event',
        actor: 'arlo',
        outcome: 'success',
        targetId: args.eventId,
        details: 'Deleted calendar event',
      })

      return { success: true, message: 'Calendar event deleted' }
    } catch (error) {
      console.error('Failed to delete calendar event:', error)
      return { success: false, error: 'Failed to delete calendar event' }
    }
  },
})

export const checkCalendarAvailability = createTool({
  description: 'Check if a time slot is free on the calendar',
  args: z.object({
    startTime: z.string().describe('Start time to check in ISO format'),
    endTime: z.string().describe('End time to check in ISO format'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { available: false, error: result.error }
    }

    const nango = getNangoClient()

    try {
      const response = await nango.proxy({
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
        params: {
          timeMin: args.startTime,
          timeMax: args.endTime,
          singleEvents: 'true',
        },
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      const events = (response.data as { items?: Array<unknown> }).items || []
      const available = events.length === 0

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'check_availability',
        actor: 'arlo',
        outcome: 'success',
        details: available ? 'Time slot is available' : `Found ${events.length} conflicting events`,
      })

      return {
        available,
        message: available
          ? 'This time slot is free'
          : `There are ${events.length} event(s) during this time`,
        conflictCount: events.length,
      }
    } catch (error) {
      console.error('Failed to check availability:', error)
      return { available: false, error: 'Failed to check calendar availability' }
    }
  },
})
```

**Step 2: Add internal query for calendar tools**

Add to `convex/integrations.ts`:

```typescript
// Internal query: Get integration by userId and provider (for tools)
export const getByUserIdAndProvider = internalQuery({
  args: {
    userId: v.id('users'),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', args.userId).eq('provider', args.provider)
      )
      .first()
  },
})
```

Also add the import at the top:

```typescript
import { query, mutation, action, internalMutation, internalQuery } from './_generated/server'
```

**Step 3: Verify no type errors**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add convex/arlo/tools/calendar.ts convex/integrations.ts
git commit -m "feat: add Google Calendar tools for Arlo"
```

---

## Task 8: Register Calendar Tools with Arlo Agent

**Files:**

- Modify: `convex/arlo/agent.ts`

**Step 1: Read current agent.ts to understand structure**

Read the current file to see how tools are registered.

**Step 2: Import and register calendar tools**

Add the imports at the top of `convex/arlo/agent.ts`:

```typescript
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  checkCalendarAvailability,
} from './tools/calendar'
```

Then add the calendar tools to the tools array in the agent definition:

```typescript
tools: [
  // ... existing tools ...
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  checkCalendarAvailability,
],
```

**Step 3: Verify no type errors**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Test Convex dev server**

Run: `npx convex dev --once`
Expected: Deploys successfully

**Step 5: Commit**

```bash
git add convex/arlo/agent.ts
git commit -m "feat: register calendar tools with Arlo agent"
```

---

## Task 9: Run Full Quality Check

**Files:**

- None (verification only)

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors (or only existing warnings)

**Step 3: Run format check**

Run: `pnpm format:check`
Expected: All files formatted (or run `pnpm format` to fix)

**Step 4: Final commit if format changes**

```bash
git add -A
git commit -m "style: format files"
```

---

## Task 10: Manual Testing Checklist

**Test the integration flow:**

1. Start dev server: `pnpm dev`
2. Navigate to `/settings/integrations`
3. Verify Google Calendar card appears with "Connect" button
4. Click "Connect" - Nango OAuth modal should open
5. Complete Google OAuth flow
6. Card should update to show "Connected" status
7. Click "Disconnect" - status should revert to "Connect"

**Test Arlo calendar tools:**

1. Connect Google Calendar
2. In chat, ask Arlo: "What's on my calendar this week?"
3. Arlo should use `getCalendarEvents` tool and return events
4. Ask Arlo: "Create a meeting called 'Test Meeting' tomorrow at 2pm for 1 hour"
5. Verify event appears in Google Calendar
6. Ask Arlo: "Delete the Test Meeting event" (should ask for confirmation)

---

## Summary

| Task | Description                   | Key Files                                            |
| ---- | ----------------------------- | ---------------------------------------------------- |
| 1    | Install dependencies          | package.json                                         |
| 2    | Add integrations table        | convex/schema.ts                                     |
| 3    | Create Nango client wrapper   | convex/lib/nango.ts                                  |
| 4    | Create integrations functions | convex/integrations.ts                               |
| 5    | Add webhook handler           | convex/http.ts                                       |
| 6    | Create settings UI            | app/settings/integrations/, components/integrations/ |
| 7    | Create calendar tools         | convex/arlo/tools/calendar.ts                        |
| 8    | Register tools with agent     | convex/arlo/agent.ts                                 |
| 9    | Quality check                 | N/A                                                  |
| 10   | Manual testing                | N/A                                                  |

**Total commits:** 8-9 focused commits following the pattern of one logical change per commit.
