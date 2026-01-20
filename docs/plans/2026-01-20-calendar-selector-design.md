# Calendar Selector Design

## Overview

Add a settings UI to let users choose which Google Calendars Arlo can access. After connecting Google Calendar, users see a list of all their calendars with toggles to enable/disable each one.

## Requirements

- **Full exclusion**: Disabled calendars are invisible to Arlo (no read, no write)
- **Require enabled calendar**: Event creation fails if no calendars are enabled
- **Primary only by default**: New connections start with only the primary calendar enabled

## Data Model

Add `enabledCalendarIds` field to the existing `integrations` table:

```typescript
// In schema.ts - integrations table
integrations: defineTable({
  // ... existing fields ...
  // NEW: Calendar IDs that Arlo can access. Empty/undefined = primary only
  enabledCalendarIds: v.optional(v.array(v.string())),
})
```

**Behavior:**

- `undefined` or empty array → only "primary" calendar is enabled
- Array with IDs → only those specific calendars are enabled
- Backwards-compatible with existing integrations

## Backend Changes

### New functions in integrations.ts

```typescript
// Action: Fetch calendars from Google (wraps existing listCalendars)
export const fetchCalendars = action({
  args: {},
  handler: async (ctx) => {
    // Get integration, call listCalendars action, return results
  },
})

// Mutation: Toggle a calendar on/off
export const setCalendarEnabled = mutation({
  args: {
    calendarId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Update enabledCalendarIds array
  },
})
```

### Modify existing calendar actions

**getEvents** and **checkAvailability**:

- Before querying calendars, filter by `enabledCalendarIds`
- If `enabledCalendarIds` is undefined/empty, use `["primary"]`

**createEvent**:

- Get list of enabled calendars with write access ("owner" or "writer" role)
- Use first available, preferring primary if enabled
- Fail with clear error if no enabled calendars have write access

## UI Changes

Expand `IntegrationCard` when connected to show calendar toggles:

```
┌─────────────────────────────────────────────────────┐
│ 📅 Google Calendar                      [Connected] │
│ Read and manage calendar events                     │
│                                                     │
│ ─── Calendars Arlo can access ───────────────────── │
│                                                     │
│ ☑ Primary Calendar (chris@gmail.com)                │
│ ☐ Family                                            │
│ ☐ Work                                              │
│ ☐ Holidays in United States                         │
│                                                     │
│                                        [Disconnect] │
└─────────────────────────────────────────────────────┘
```

### New component: CalendarSelector.tsx

- Fetches calendars via `fetchCalendars` action
- Renders list with checkboxes
- Each toggle calls `setCalendarEnabled` mutation
- Shows loading state while fetching
- Primary calendar marked with "(Primary)" label

## Edge Cases

**No calendars enabled:**

- `getEvents` → returns empty array
- `checkAvailability` → returns `{ available: true, conflictCount: 0 }`
- `createEvent` → returns error: "No calendars enabled. Enable at least one calendar in Settings → Integrations."

**Deleted calendars:**

- Stale IDs in `enabledCalendarIds` fail silently (existing try/catch handles this)
- No cleanup required for MVP

**Access roles:**

- Only "owner" or "writer" calendars can be used for event creation
- "reader" and "freeBusyReader" calendars can be enabled for reading only

**Backwards compatibility:**

- Existing integrations have `enabledCalendarIds: undefined`
- Treated as "primary only" - same behavior as before multi-calendar feature

## Files to Modify

1. `convex/schema.ts` - add `enabledCalendarIds` field
2. `convex/integrations.ts` - add `fetchCalendars` action and `setCalendarEnabled` mutation
3. `convex/arlo/calendarActions.ts` - filter by enabled calendars in getEvents, checkAvailability, createEvent
4. `components/integrations/CalendarSelector.tsx` - new component
5. `components/integrations/IntegrationCard.tsx` - expand to show CalendarSelector when connected
6. `app/settings/integrations/page.tsx` - pass integration data to card
