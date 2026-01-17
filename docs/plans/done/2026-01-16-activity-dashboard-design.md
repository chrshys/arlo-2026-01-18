# Activity Dashboard Design

**Date:** 2026-01-16
**Status:** Approved, ready for implementation

## Overview

Add an activity dashboard to track AI usage and spend. This provides visibility into token consumption and costs per request, accessible via a new settings section.

## Requirements

- View per-request activity log with timestamps, model, tokens, cost
- Link activity to conversation threads
- Basic pagination (25/50/100 items per page)
- Settings section with sidebar navigation for future expansion

## Route Structure

```
app/
  settings/
    layout.tsx           # Settings shell with sidebar
    page.tsx             # Redirects to /settings/activity
    activity/
      page.tsx           # Activity table
```

## Data Layer

### Query: `convex/usage.ts`

```typescript
export const activityLog = query({
  args: {
    limit: v.optional(v.number()), // 25, 50, or 100 (default: 25)
    cursor: v.optional(v.string()), // for pagination
  },
  handler: async (ctx, args) => {
    // Query agent messages that have gateway cost data
    // Filter to assistant messages with providerMetadata.gateway.cost
    // Sort by _creationTime descending (newest first)
    // Return paginated results
  },
})
```

**Data source:** Existing agent messages table. The AI Gateway already stores cost metadata on each message:

```typescript
{
  _creationTime: 1768585311736,
  model: "anthropic/claude-sonnet-4",
  threadId: "m574469ac3jmf95pfz2m12h0kn7zatah",
  usage: {
    promptTokens: 792,
    completionTokens: 46,
    totalTokens: 838
  },
  providerMetadata: {
    gateway: {
      cost: "0.003066"
    }
  }
}
```

No new tables required.

## UI Components

### SettingsLayout (`app/settings/layout.tsx`)

Settings shell with sidebar navigation:

- Left sidebar (~200px width)
- Nav items with active state
- Initially just "Activity" link
- Placeholder structure for future settings pages
- Main content slot for child pages

### ActivityPage (`app/settings/activity/page.tsx`)

- Page title: "Activity"
- Pagination controls (25 / 50 / 100 selector)
- ActivityTable component
- Loading and empty states

### ActivityTable (`components/ActivityTable.tsx`)

| Column    | Source                          | Format                                    |
| --------- | ------------------------------- | ----------------------------------------- |
| Timestamp | `_creationTime`                 | "Jan 16, 12:44 PM"                        |
| Model     | `model`                         | `claude-sonnet-4` (strip provider prefix) |
| Thread    | `threadId`                      | Truncated ID, links to chat               |
| Tokens    | `usage`                         | `764 → 40` (in → out)                     |
| Cost      | `providerMetadata.gateway.cost` | `$0.0029`                                 |

Styling:

- Clean table with `border-b` separators
- Hover states on rows
- Match existing Tailwind patterns (grays, spacing)

## Not Included (YAGNI)

These can be added later if needed:

- Summary cards with charts (spend over time, etc.)
- Date range filtering
- Speed/TPS calculation
- Export functionality
- Per-model or per-thread aggregation views

## Implementation Notes

1. The settings layout should be generic enough to add more settings pages later
2. Thread links can initially just show the ID; deep-linking to specific threads can come later
3. Pagination uses Convex's cursor-based pagination pattern
4. Model names come as `anthropic/claude-sonnet-4`; strip the provider prefix for display
