# Calendar Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users toggle which Google Calendars Arlo can access via Settings → Integrations.

**Architecture:** Add `enabledCalendarIds` array to integrations table. Filter calendar operations by this list. Show toggles in IntegrationCard after connection.

**Tech Stack:** Convex (schema, queries, mutations, actions), React, TypeScript

---

## Task 1: Update Schema

**Files:**

- Modify: `convex/schema.ts:109-120`

**Step 1: Add enabledCalendarIds field to integrations table**

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
})
  .index('by_user', ['userId'])
  .index('by_user_and_provider', ['userId', 'provider'])
  .index('by_nango_connection', ['nangoConnectionId']),
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (field is optional, no breaking changes)

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add enabledCalendarIds to integrations table"
```

---

## Task 2: Add fetchCalendars Action

**Files:**

- Modify: `convex/integrations.ts`
- Create: `convex/integrationsNode.ts` (add action)

**Step 1: Add fetchCalendars action to integrationsNode.ts**

This needs to be in a `'use node'` file since it calls the Nango API.

```typescript
// Add to convex/integrationsNode.ts
import { v } from 'convex/values'
import { action } from './_generated/server'
import { internal } from './_generated/api'
import { GOOGLE_CALENDAR_PROVIDER } from './lib/integrationConstants'

export const fetchCalendars = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    // Get user from Clerk ID
    const user = await ctx.runQuery(internal.users.getByClerkId, {
      clerkId: identity.subject,
    })
    if (!user) {
      throw new Error('User not found')
    }

    // Get Google Calendar integration
    const integration = await ctx.runQuery(internal.integrations.getByUserIdAndProvider, {
      userId: user._id,
      provider: GOOGLE_CALENDAR_PROVIDER,
    })

    if (!integration || integration.status !== 'active') {
      return { calendars: [], error: 'Google Calendar not connected' }
    }

    // Fetch calendars from Google via Nango
    const result = await ctx.runAction(internal.arlo.calendarActions.listCalendars, {
      nangoConnectionId: integration.nangoConnectionId,
    })

    return {
      calendars: result.calendars,
      enabledCalendarIds: integration.enabledCalendarIds || ['primary'],
    }
  },
})
```

**Step 2: Add internal getByClerkId query to users.ts if not exists**

Check if `internal.users.getByClerkId` exists. If not, add:

```typescript
// convex/users.ts - add internal query
export const getByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .first()
  },
})
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/integrationsNode.ts convex/users.ts
git commit -m "feat(integrations): add fetchCalendars action"
```

---

## Task 3: Add setCalendarEnabled Mutation

**Files:**

- Modify: `convex/integrations.ts`

**Step 1: Add setCalendarEnabled mutation**

```typescript
// Mutation: Toggle a calendar on/off
export const setCalendarEnabled = mutation({
  args: {
    calendarId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', user._id).eq('provider', GOOGLE_CALENDAR_PROVIDER)
      )
      .first()

    if (!integration) {
      throw new Error('Google Calendar not connected')
    }

    // Get current enabled calendars (default to primary only)
    const currentEnabled = integration.enabledCalendarIds || ['primary']

    let newEnabled: string[]
    if (args.enabled) {
      // Add calendar if not already present
      newEnabled = currentEnabled.includes(args.calendarId)
        ? currentEnabled
        : [...currentEnabled, args.calendarId]
    } else {
      // Remove calendar
      newEnabled = currentEnabled.filter((id) => id !== args.calendarId)
    }

    await ctx.db.patch(integration._id, {
      enabledCalendarIds: newEnabled,
    })

    return { enabledCalendarIds: newEnabled }
  },
})
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/integrations.ts
git commit -m "feat(integrations): add setCalendarEnabled mutation"
```

---

## Task 4: Filter getEvents by Enabled Calendars

**Files:**

- Modify: `convex/arlo/calendarActions.ts:59-132`
- Modify: `__tests__/calendar-actions.test.ts`

**Step 1: Update getEvents to accept enabledCalendarIds parameter**

```typescript
// Get calendar events from enabled calendars only
export const getEvents = internalAction({
  args: {
    nangoConnectionId: v.string(),
    timeMin: v.string(),
    timeMax: v.string(),
    query: v.optional(v.string()),
    enabledCalendarIds: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    // Get enabled calendar IDs (default to primary only)
    const enabledIds = args.enabledCalendarIds || ['primary']

    // First, get all calendars
    const calendarListResponse = await nango.proxy({
      method: 'GET',
      endpoint: '/calendar/v3/users/me/calendarList',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
    })

    const allCalendars = (calendarListResponse.data as { items?: GoogleCalendar[] }).items || []

    // Filter to only enabled calendars
    const calendars = allCalendars.filter((cal) => enabledIds.includes(cal.id))

    // ... rest of implementation unchanged (query each calendar, merge results)
```

**Step 2: Update the calendar tool to pass enabledCalendarIds**

Modify `convex/arlo/tools/calendar.ts` getCalendarEvents handler:

```typescript
// In getCalendarEvents handler, after getting integration:
const response = await ctx.runAction(internal.arlo.calendarActions.getEvents, {
  nangoConnectionId: result.integration.nangoConnectionId,
  timeMin,
  timeMax,
  query: args.query,
  enabledCalendarIds: result.integration.enabledCalendarIds,
})
```

This requires updating getCalendarConnection to return enabledCalendarIds.

**Step 3: Update getCalendarConnection helper**

```typescript
export async function getCalendarConnection(
  ctx: any,
  userId: Id<'users'>
): Promise<CalendarConnectionResult> {
  // ... existing code ...

  return {
    integration: {
      _id: integration._id,
      nangoConnectionId: integration.nangoConnectionId,
      status: integration.status,
      enabledCalendarIds: integration.enabledCalendarIds,
    },
    timezone,
  }
}
```

Update the type:

```typescript
export type CalendarConnectionResult =
  | { error: string }
  | {
      integration: {
        _id: Id<'integrations'>
        nangoConnectionId: string
        status: string
        enabledCalendarIds?: string[]
      }
      timezone: string
    }
```

**Step 4: Update tests**

Update `__tests__/calendar-actions.test.ts` to pass enabledCalendarIds in test cases.

**Step 5: Run tests**

Run: `pnpm test:run`
Expected: PASS

**Step 6: Commit**

```bash
git add convex/arlo/calendarActions.ts convex/arlo/tools/calendar.ts __tests__/calendar-actions.test.ts
git commit -m "feat(calendar): filter getEvents by enabled calendars"
```

---

## Task 5: Filter checkAvailability by Enabled Calendars

**Files:**

- Modify: `convex/arlo/calendarActions.ts:227-278`

**Step 1: Update checkAvailability to accept enabledCalendarIds**

```typescript
// Check availability across enabled calendars only
export const checkAvailability = internalAction({
  args: {
    nangoConnectionId: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    enabledCalendarIds: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    // Get enabled calendar IDs (default to primary only)
    const enabledIds = args.enabledCalendarIds || ['primary']

    // First, get all calendars
    const calendarListResponse = await nango.proxy({
      method: 'GET',
      endpoint: '/calendar/v3/users/me/calendarList',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
    })

    const allCalendars = (calendarListResponse.data as { items?: GoogleCalendar[] }).items || []

    // Filter to only enabled calendars
    const calendars = allCalendars.filter((cal) => enabledIds.includes(cal.id))

    // ... rest unchanged
```

**Step 2: Update calendar tool to pass enabledCalendarIds**

In `convex/arlo/tools/calendar.ts` checkCalendarAvailability handler:

```typescript
const response = await ctx.runAction(internal.arlo.calendarActions.checkAvailability, {
  nangoConnectionId: result.integration.nangoConnectionId,
  startTime: args.startTime,
  endTime: args.endTime,
  enabledCalendarIds: result.integration.enabledCalendarIds,
})
```

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/arlo/calendarActions.ts convex/arlo/tools/calendar.ts
git commit -m "feat(calendar): filter checkAvailability by enabled calendars"
```

---

## Task 6: Update createEvent to Use Enabled Calendars

**Files:**

- Modify: `convex/arlo/calendarActions.ts:135-170`
- Modify: `convex/arlo/tools/calendar.ts`

**Step 1: Update createEvent to accept calendarId parameter**

```typescript
// Create calendar event on specified calendar
export const createEvent = internalAction({
  args: {
    nangoConnectionId: v.string(),
    calendarId: v.optional(v.string()), // NEW: which calendar to create on
    title: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
    timezone: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()
    const tz = args.timezone || DEFAULT_TIMEZONE
    const targetCalendar = args.calendarId || 'primary'

    const response = await nango.proxy({
      method: 'POST',
      endpoint: `/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
      data: {
        summary: args.title,
        start: { dateTime: args.startTime, timeZone: tz },
        end: { dateTime: args.endTime, timeZone: tz },
        description: args.description,
        location: args.location,
        attendees: args.attendees?.map((email) => ({ email })),
      },
    })

    return {
      eventId: (response.data as { id: string }).id,
    }
  },
})
```

**Step 2: Update createCalendarEvent tool to pick enabled calendar**

```typescript
// In createCalendarEvent handler:
handler: async (ctx, args) => {
  const userId = getUserId(ctx)
  const result = await getCalendarConnection(ctx, userId)

  if ('error' in result) {
    return { eventId: null, error: result.error }
  }

  // Get enabled calendars with write access
  const enabledIds = result.integration.enabledCalendarIds || ['primary']

  if (enabledIds.length === 0) {
    return {
      eventId: null,
      error: 'No calendars enabled. Enable at least one calendar in Settings → Integrations.',
    }
  }

  // Use primary if enabled, otherwise first enabled calendar
  const targetCalendar = enabledIds.includes('primary') ? 'primary' : enabledIds[0]

  try {
    const response = (await ctx.runAction(internal.arlo.calendarActions.createEvent, {
      nangoConnectionId: result.integration.nangoConnectionId,
      calendarId: targetCalendar,
      title: args.title,
      // ... rest of args
    }))
    // ... rest unchanged
```

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/arlo/calendarActions.ts convex/arlo/tools/calendar.ts
git commit -m "feat(calendar): create events on enabled calendar"
```

---

## Task 7: Create CalendarSelector Component

**Files:**

- Create: `components/integrations/CalendarSelector.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useAction, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useEffect, useState } from 'react'

interface Calendar {
  id: string
  name: string
  primary: boolean
  accessRole: string
}

interface CalendarSelectorProps {
  isConnected: boolean
}

export function CalendarSelector({ isConnected }: CalendarSelectorProps) {
  const fetchCalendars = useAction(api.integrationsNode.fetchCalendars)
  const setCalendarEnabled = useMutation(api.integrations.setCalendarEnabled)

  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [enabledIds, setEnabledIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected) return

    const load = async () => {
      try {
        setLoading(true)
        const result = await fetchCalendars()
        if (result.error) {
          setError(result.error)
        } else {
          setCalendars(result.calendars)
          setEnabledIds(result.enabledCalendarIds)
        }
      } catch (e) {
        setError('Failed to load calendars')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isConnected, fetchCalendars])

  const handleToggle = async (calendarId: string, enabled: boolean) => {
    // Optimistic update
    setEnabledIds((prev) =>
      enabled ? [...prev, calendarId] : prev.filter((id) => id !== calendarId)
    )

    try {
      await setCalendarEnabled({ calendarId, enabled })
    } catch (e) {
      // Revert on error
      setEnabledIds((prev) =>
        enabled ? prev.filter((id) => id !== calendarId) : [...prev, calendarId]
      )
    }
  }

  if (!isConnected) return null
  if (loading) return <div className="text-sm text-muted-foreground mt-4">Loading calendars...</div>
  if (error) return <div className="text-sm text-red-500 mt-4">{error}</div>

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="text-sm font-medium mb-3">Calendars Arlo can access</h4>
      <div className="space-y-2">
        {calendars.map((cal) => (
          <label key={cal.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabledIds.includes(cal.id)}
              onChange={(e) => handleToggle(cal.id, e.target.checked)}
              className="rounded border-border"
            />
            <span>
              {cal.name}
              {cal.primary && (
                <span className="text-muted-foreground ml-1">(Primary)</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add components/integrations/CalendarSelector.tsx
git commit -m "feat(ui): add CalendarSelector component"
```

---

## Task 8: Integrate CalendarSelector into IntegrationCard

**Files:**

- Modify: `components/integrations/IntegrationCard.tsx`

**Step 1: Import and render CalendarSelector**

```typescript
'use client'

import { NangoConnectButton } from './NangoConnectButton'
import { CalendarSelector } from './CalendarSelector'

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
  const isGoogleCalendar = provider === 'google-calendar'

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-start gap-4">
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

      {isGoogleCalendar && <CalendarSelector isConnected={isConnected} />}
    </div>
  )
}
```

**Step 2: Run typecheck and lint**

Run: `pnpm check`
Expected: PASS

**Step 3: Commit**

```bash
git add components/integrations/IntegrationCard.tsx
git commit -m "feat(ui): integrate CalendarSelector into IntegrationCard"
```

---

## Task 9: Final Testing and Cleanup

**Step 1: Run all checks**

Run: `pnpm check && pnpm test:run`
Expected: All pass

**Step 2: Manual testing checklist**

- [ ] Connect Google Calendar integration
- [ ] Verify calendar list appears with primary checked
- [ ] Toggle a secondary calendar on
- [ ] Verify Arlo sees events from both calendars
- [ ] Toggle primary off, verify Arlo only sees secondary
- [ ] Toggle all off, verify createEvent fails with helpful error
- [ ] Disconnect and reconnect, verify defaults to primary only

**Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup and formatting"
```

---

## Summary

| Task | Description                                     |
| ---- | ----------------------------------------------- |
| 1    | Add `enabledCalendarIds` to schema              |
| 2    | Add `fetchCalendars` action                     |
| 3    | Add `setCalendarEnabled` mutation               |
| 4    | Filter `getEvents` by enabled calendars         |
| 5    | Filter `checkAvailability` by enabled calendars |
| 6    | Update `createEvent` to use enabled calendar    |
| 7    | Create `CalendarSelector` component             |
| 8    | Integrate into `IntegrationCard`                |
| 9    | Final testing and cleanup                       |
