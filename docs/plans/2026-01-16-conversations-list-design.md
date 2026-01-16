# Conversations List Design

**Date:** 2026-01-16

**Goal:** Allow users to view, switch between, and create conversations in the list panel.

---

## Summary

Add a conversation list to the left panel that shows all threads with auto-generated titles. Users can switch between conversations and explicitly create new ones.

## Decisions

| Decision          | Choice                               | Rationale                                           |
| ----------------- | ------------------------------------ | --------------------------------------------------- |
| Title generation  | Auto-generated from first message    | Simple, no extra API calls, provides useful context |
| List item content | Minimal (title + relative timestamp) | Clean and scannable for MVP                         |
| Actions           | Explicit new + click to switch       | Clear intent, prevents accidental new threads       |

## Future Enhancements

- AI-generated conversation titles after first exchange
- Delete conversations
- Search/filter conversations
- Rename conversations

---

## Data Layer

### New Query: `convex/threads.ts`

```typescript
export const list = query({
  handler: async (ctx) => {
    // Use agent component's listThreadsByUserId
    // No userId filter for now (single user)
    // Returns threads sorted by _creationTime descending
  },
})
```

### Title Generation: `convex/chat.ts`

After sending the first user message to a thread:

1. Check if thread has a title
2. If not, extract first ~50 characters of the message
3. Call `updateThreadMetadata` to set the title

No schema changes needed — the agent component already stores `title` on threads.

---

## UI Components

### ConversationList (`components/ConversationList.tsx`)

```
┌─────────────────────────────┐
│ Conversations        [+ ]  │  ← Header with "New" button
├─────────────────────────────┤
│ ▌ Help me with task...     │  ← Selected (highlight)
│   2 hours ago               │
├─────────────────────────────┤
│   What's on my calendar     │
│   Yesterday                 │
├─────────────────────────────┤
│   Morning planning          │
│   3 days ago                │
└─────────────────────────────┘
```

**Props:**

- `selectedThreadId: string | null`
- `onSelectThread: (threadId: string) => void`
- `onNewThread: () => void`

**Behavior:**

- Click item → calls `onSelectThread` with thread ID
- Click "+" button → calls `onNewThread`
- Selected conversation has visual highlight
- Empty state: "No conversations yet"

**Relative timestamps:**

- < 1 hour: "X minutes ago"
- < 24 hours: "X hours ago"
- < 7 days: "Yesterday" / "X days ago"
- Older: "Jan 16" format

---

## Integration

### `app/page.tsx`

```tsx
const [threadId, setThreadId] = useState<string | null>(null)
const createThread = useMutation(api.threads.create)

const handleNewThread = async () => {
  const newThreadId = await createThread()
  setThreadId(newThreadId)
}

// In list panel:
<ConversationList
  selectedThreadId={threadId}
  onSelectThread={setThreadId}
  onNewThread={handleNewThread}
/>

// In focus panel:
<Chat threadId={threadId} />
```

### `components/Chat.tsx`

Remove auto-create-thread logic:

- Remove `onThreadCreated` prop
- Remove `isCreatingThread` state
- If `threadId` is null, show: "Select a conversation or start a new one"
- Simplify `handleSubmit` — just send message, no thread creation

### `convex/chat.ts`

Update `send` mutation to set thread title on first message:

```typescript
// After saving user message:
const threadMeta = await getThreadMetadata(ctx, components.agent, { threadId })
if (!threadMeta.title) {
  const title = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '')
  await updateThreadMetadata(ctx, components.agent, { threadId, patch: { title } })
}
```

---

## Files to Create/Modify

| File                              | Action | Purpose                                     |
| --------------------------------- | ------ | ------------------------------------------- |
| `convex/threads.ts`               | Modify | Add `list` query                            |
| `convex/chat.ts`                  | Modify | Add title generation on first message       |
| `components/ConversationList.tsx` | Create | Conversation list component                 |
| `components/Chat.tsx`             | Modify | Remove auto-create, handle null threadId    |
| `app/page.tsx`                    | Modify | Wire up ConversationList, handle new thread |

---

## Implementation Order

1. Add `list` query to `convex/threads.ts`
2. Create `ConversationList` component
3. Update `app/page.tsx` to wire up the list
4. Update `Chat.tsx` to remove auto-create logic
5. Add title generation to `convex/chat.ts`
6. Test end-to-end flow
