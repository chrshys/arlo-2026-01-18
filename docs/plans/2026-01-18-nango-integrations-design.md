# Nango Integrations Design

**Date:** 2026-01-18
**Status:** Approved
**First Integration:** Google Calendar (full CRUD)

## Overview

Integrate external services (starting with Google Calendar) using Nango for OAuth management. Nango handles token storage, refresh, and lifecycle—we store only connection IDs.

## Architecture Decisions

- **Session creation:** Convex actions (not Next.js API routes)
- **UI location:** Settings page (`/settings/integrations`)
- **Auth assumption:** Clerk auth is implemented, `userId` available in Convex
- **Google Calendar scope:** Full CRUD (read, create, update, delete)

## Data Model

```typescript
// convex/schema.ts
integrations: defineTable({
  userId: v.string(), // Clerk user ID
  provider: v.string(), // "google-calendar", "gmail", "github"
  nangoConnectionId: v.string(), // Nango's connection identifier
  status: v.union(v.literal('active'), v.literal('expired'), v.literal('revoked')),
  scopes: v.array(v.string()), // Granted permissions
  connectedAt: v.number(), // Timestamp
  lastUsedAt: v.optional(v.number()), // For debugging/display
})
  .index('by_user', ['userId'])
  .index('by_user_and_provider', ['userId', 'provider'])
  .index('by_nango_connection', ['nangoConnectionId'])
```

## Connection Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │   Convex    │     │    Nango    │     │   Google    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. Click "Connect Google Calendar"    │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ 2. createSession  │                   │
       │                   │   (userId, provider)                  │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │ 3. sessionToken   │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │ 4. sessionToken   │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │ 5. Open Nango Connect UI (modal)      │                   │
       │──────────────────────────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ 6. OAuth flow     │
       │                   │                   │──────────────────>│
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │ 7. onSuccess(connectionId)            │                   │
       │<──────────────────────────────────────│                   │
       │                   │                   │                   │
       │ 8. saveConnection │                   │                   │
       │   (connectionId)  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ 9. Webhook (backup confirmation)      │
       │                   │<──────────────────│                   │
```

**Steps:**

1. User clicks "Connect Google Calendar" in settings
2. Frontend calls Convex action `integrations.createSession`
3. Action calls Nango API with `userId` and `provider`, gets session token
4. Token returned to frontend
5. Frontend initializes Nango Connect UI with token—modal opens
6. User completes Google OAuth in the modal
7. Nango fires `onSuccess` callback with `connectionId`
8. Frontend calls Convex mutation to save the connection
9. Nango also sends webhook (handles cases where browser closes mid-flow)

## Using Connections (Arlo Making API Calls)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Arlo     │     │   Convex    │     │    Nango    │     │   Google    │
│   (Agent)   │     │    (DB)     │     │             │     │  Calendar   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. Tool: getUpcomingEvents(userId)    │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │ 2. Query integrations table           │                   │
       │   → get nangoConnectionId             │                   │
       │                   │                   │                   │
       │ 3. nango.proxy.get('/calendars/...')  │                   │
       │   with connectionId                   │                   │
       │───────────────────────────────────────>                   │
       │                   │                   │                   │
       │                   │                   │ 4. Inject token,  │
       │                   │                   │    forward request│
       │                   │                   │──────────────────>│
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │ 5. Calendar events│                   │                   │
       │<──────────────────────────────────────│                   │
```

Use Nango's proxy for API calls—it handles token refresh automatically.

## Webhook Handler

```typescript
// convex/http.ts
http.route({
  path: '/webhooks/nango',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    // Verify signature, then handle:
    // - auth.creation → upsert integration
    // - auth.refresh_error → set status "expired"
    // - auth.revoked → set status "revoked"
  }),
})
```

**Webhook URL:** `https://<deployment>.convex.site/webhooks/nango`

## Settings UI

```
/settings/integrations

┌─────────────────────────────────────────┐
│ 📅 Google Calendar          [Connected] │
│ Read and manage calendar events         │
│                          [Disconnect]   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📧 Gmail                      [Connect] │
│ Read emails and extract action items    │
└─────────────────────────────────────────┘
```

**States:** Not connected, Connected, Expired (warning + reconnect), Revoked (warning + reconnect)

## Arlo Calendar Tools

| Tool                  | Args                                                                 | Description                |
| --------------------- | -------------------------------------------------------------------- | -------------------------- |
| `getCalendarEvents`   | `{ startDate?, endDate?, query? }`                                   | List events in date range  |
| `getCalendarEvent`    | `{ eventId }`                                                        | Get single event details   |
| `createCalendarEvent` | `{ title, startTime, endTime, description?, attendees?, location? }` | Create new event           |
| `updateCalendarEvent` | `{ eventId, title?, startTime?, endTime?, description?, location? }` | Modify existing event      |
| `deleteCalendarEvent` | `{ eventId }`                                                        | Delete an event            |
| `checkAvailability`   | `{ startTime, endTime }`                                             | Check if time slot is free |

**Confirmation behavior:** Arlo confirms before destructive actions (delete, bulk operations).

**Error handling:**

- Not connected → "Connect in Settings → Integrations"
- Token expired → "Please reconnect in Settings"
- Event not found → "Can you give me more details?"

## File Structure

```
convex/
├── schema.ts                    # Add integrations table
├── integrations.ts              # Queries, mutations, actions
├── http.ts                      # Webhook handler
├── arlo/tools/calendar.ts       # Calendar tools
└── lib/nango.ts                 # Nango client wrapper

app/settings/integrations/
└── page.tsx                     # Settings page

components/integrations/
├── IntegrationCard.tsx          # Reusable card component
└── NangoConnectButton.tsx       # Nango SDK wrapper
```

## Implementation Order

1. Nango account + Google Calendar integration setup in dashboard
2. `convex/schema.ts` — add integrations table
3. `convex/lib/nango.ts` — Nango client wrapper
4. `convex/integrations.ts` — createSession action
5. `convex/http.ts` — webhook handler
6. Settings UI components + page
7. `convex/arlo/tools/calendar.ts` — calendar tools
8. Register tools with Arlo agent

## Environment Variables

```bash
# Convex (npx convex env set)
NANGO_SECRET_KEY=xxx
NANGO_WEBHOOK_SECRET=xxx
```

## Dependencies

```bash
pnpm add @nangohq/node @nangohq/frontend
```
