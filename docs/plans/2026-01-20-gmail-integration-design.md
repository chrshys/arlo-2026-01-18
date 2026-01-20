# Gmail Integration Design

**Date:** 2026-01-20
**Status:** Approved

## Overview

Add Gmail integration to Arlo via Nango, enabling email reading, drafting, sending, and label management. Permission levels and send confirmation are configurable per-user.

## Configuration Model

### Schema additions to `integrations` table

```typescript
// Gmail-specific fields (optional, only set for gmail provider)
gmailPermissionLevel: v.optional(
  v.union(v.literal('read'), v.literal('read_draft'), v.literal('read_draft_send'))
),
gmailRequireConfirmation: v.optional(v.boolean()), // only relevant when permission includes send
```

### Permission levels map to OAuth scopes

| Level             | Scopes                             | Capabilities                       |
| ----------------- | ---------------------------------- | ---------------------------------- |
| `read`            | `gmail.readonly`                   | Search, read emails and threads    |
| `read_draft`      | `gmail.readonly` + `gmail.compose` | Above + create/edit drafts         |
| `read_draft_send` | `gmail.modify`                     | Above + send emails, manage labels |

### Defaults

- New connections default to `read_draft` (safest useful default)
- `gmailRequireConfirmation` defaults to `true`

### UI

When Gmail is connected, show a collapsible settings section:

```
┌─────────────────────────────────────────────────────┐
│ 📧 Gmail                              [Disconnect]  │
│ Read, draft, and send emails                        │
│ ✓ Connected                                         │
│                                                     │
│ ▼ Settings                                          │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Permission level                                │ │
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │ Read + Draft                            ▼  │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ │                                                 │ │
│ │ ☑ Require confirmation before sending          │ │
│ │   (only visible when "Read + Draft + Send")    │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Changing permission level may require re-authentication if upgrading scopes.

## Backend Actions

**New file: `convex/arlo/gmailActions.ts`**

All actions use `nango.proxy()` for API calls.

### Message Operations

| Action           | Gmail API Endpoint                         | Purpose                              |
| ---------------- | ------------------------------------------ | ------------------------------------ |
| `listMessages`   | `GET /gmail/v1/users/me/messages`          | List message IDs with optional query |
| `getMessage`     | `GET /gmail/v1/users/me/messages/{id}`     | Fetch full message (headers + body)  |
| `searchMessages` | `GET /gmail/v1/users/me/messages?q=...`    | Search with Gmail query syntax       |
| `getThread`      | `GET /gmail/v1/users/me/threads/{id}`      | Fetch entire conversation thread     |
| `createDraft`    | `POST /gmail/v1/users/me/drafts`           | Create draft email                   |
| `sendMessage`    | `POST /gmail/v1/users/me/messages/send`    | Send email directly                  |
| `sendDraft`      | `POST /gmail/v1/users/me/drafts/{id}/send` | Send existing draft                  |

### Label Operations

| Action                | Gmail API Endpoint                             | Purpose                         |
| --------------------- | ---------------------------------------------- | ------------------------------- |
| `listLabels`          | `GET /gmail/v1/users/me/labels`                | Get all labels                  |
| `getLabel`            | `GET /gmail/v1/users/me/labels/{id}`           | Get label details               |
| `createLabel`         | `POST /gmail/v1/users/me/labels`               | Create custom label             |
| `updateLabel`         | `PATCH /gmail/v1/users/me/labels/{id}`         | Rename or change label settings |
| `deleteLabel`         | `DELETE /gmail/v1/users/me/labels/{id}`        | Delete custom label             |
| `modifyMessageLabels` | `POST /gmail/v1/users/me/messages/{id}/modify` | Add/remove labels from message  |
| `batchModifyLabels`   | `POST /gmail/v1/users/me/messages/batchModify` | Bulk label changes              |

### Response Transformation

Parse Gmail's raw format (base64 encoded, nested parts) into clean structure:

```typescript
{
  id: string
  threadId: string
  subject: string
  from: { name?: string, email: string }
  to: { name?: string, email: string }[]
  date: number // timestamp
  snippet: string
  body: { text?: string, html?: string }
  labels: string[]
}
```

## Arlo Agent Tools

**New file: `convex/arlo/tools/gmail.ts`**

### Reading & Search

| Tool             | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `searchEmails`   | Search inbox with query (from, subject, date range, labels, etc.) |
| `getEmail`       | Get full email content by ID                                      |
| `getEmailThread` | Get entire conversation thread                                    |
| `summarizeInbox` | Get recent unread emails with snippets                            |

### Composing

| Tool          | Description                                                          |
| ------------- | -------------------------------------------------------------------- |
| `createDraft` | Create draft email (to, subject, body, replyToMessageId?)            |
| `sendEmail`   | Send email directly (checks permission level + confirmation setting) |
| `sendDraft`   | Send an existing draft                                               |

### Organization

| Tool           | Description                  |
| -------------- | ---------------------------- |
| `listLabels`   | Get available labels         |
| `applyLabel`   | Add label to message(s)      |
| `removeLabel`  | Remove label from message(s) |
| `archiveEmail` | Remove from inbox            |
| `markAsRead`   | Mark message(s) as read      |
| `createLabel`  | Create new custom label      |
| `deleteLabel`  | Delete custom label          |

### Task Integration

| Tool                  | Description                                |
| --------------------- | ------------------------------------------ |
| `createTaskFromEmail` | Extract action item and create linked task |

### Permission Enforcement

- Tools check `gmailPermissionLevel` before executing
- `sendEmail` checks `gmailRequireConfirmation` — if true, creates draft and returns pending confirmation response

## Send Confirmation Flow

**When `gmailRequireConfirmation` is true:**

1. User asks Arlo to send an email
2. Arlo calls `sendEmail` tool
3. Tool detects confirmation required → creates draft instead
4. Tool returns structured response:

```typescript
{
  status: 'pending_confirmation',
  draftId: 'draft_abc123',
  message: 'Draft created. Reply "send it" to confirm, or "edit: [changes]" to modify.'
}
```

5. Arlo presents this to user in chat
6. User confirms → Arlo calls `sendDraft` tool
7. Email sent, activity logged

**Confirmation keywords Arlo recognizes:**

- "send it", "yes", "confirm", "looks good" → send the draft
- "cancel", "nevermind", "don't send" → delete draft
- "edit: [instructions]" → modify draft first

**Activity logging:**

- `email_draft_created` — when draft awaiting confirmation
- `email_sent` — when actually sent (includes recipient, subject)
- `email_draft_cancelled` — when user cancels

**No confirmation mode:**
When `gmailRequireConfirmation` is false, `sendEmail` sends directly and logs `email_sent`.

## Data Storage

**Fetch fresh only** — no email content stored in Convex. Always query Gmail API directly. This simplifies implementation and avoids data retention concerns.

## Implementation Summary

### Files to create

| File                                        | Purpose                                         |
| ------------------------------------------- | ----------------------------------------------- |
| `convex/arlo/gmailActions.ts`               | Internal actions for Gmail API calls via Nango  |
| `convex/arlo/tools/gmail.ts`                | Arlo agent tools for email operations           |
| `components/integrations/GmailSettings.tsx` | Settings UI for permission level + confirmation |

### Files to modify

| File                                          | Change                                                        |
| --------------------------------------------- | ------------------------------------------------------------- |
| `convex/schema.ts`                            | Add `gmailPermissionLevel`, `gmailRequireConfirmation` fields |
| `convex/lib/integrationConstants.ts`          | Add `GMAIL_PROVIDER`, `GMAIL_SCOPES`                          |
| `convex/integrations.ts`                      | Add mutations for Gmail settings, scope upgrade detection     |
| `convex/arlo/agent.ts`                        | Import and register Gmail tools, update system prompt         |
| `components/integrations/IntegrationCard.tsx` | Render GmailSettings when provider is Gmail                   |
| `app/settings/integrations/page.tsx`          | Add Gmail to `AVAILABLE_INTEGRATIONS`                         |

### Nango dashboard setup

- Create `gmail` integration with Google provider
- Configure OAuth scopes for each permission level
- Point webhook to existing `/webhooks/nango` endpoint

## Scope

~15 tools, ~10 actions, 3 new files, 6 modified files
