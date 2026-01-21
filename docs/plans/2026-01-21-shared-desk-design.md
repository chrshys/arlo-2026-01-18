# The Shared Desk: Rich Chat Experience Design

> Concept document for Arlo's shared workspace UI
> January 21, 2026

---

## The Core Metaphor

**The desk is where you and Arlo work together.**

The right panel isn't a detail view or artifact display — it's a shared workspace. Both you and Arlo can put things on the desk, reference them, update them, and clear them when done.

Chat is the conversation _about_ the work. The desk is the work _itself_.

---

## Why "Desk" Instead of "Artifacts"

The Claude Artifacts / ChatGPT Canvas pattern treats the side panel as a view into conversation artifacts — content linked to specific messages that you scroll past.

For Arlo as chief of staff, this doesn't fit. A chief of staff shares your desk:

| Artifacts Model                  | Shared Desk Model                              |
| -------------------------------- | ---------------------------------------------- |
| Content linked to messages       | Live workspace independent of chat             |
| Scroll to see history            | Shows current state                            |
| Past tense ("here's what I did") | Present tense ("here's what we're working on") |
| Read-only display                | Interactive workspace                          |
| Conversation is primary          | Work is primary                                |

The desk persists. Items stay until resolved, not until you scroll past them.

---

## Desk Structure

### Primary View

```
┌─────────────────────────────────────────┐
│ ☀️ TODAY · Tuesday, Jan 21              │
│─────────────────────────────────────────│
│ 📅 2 meetings                           │
│    9:00 AM  Standup                     │
│    2:00 PM  Design review               │
│                                         │
│ ✓ 3 tasks due                           │
│    Finish Q1 report ⚠️ 11 days overdue  │
│    Review PR #234                       │
│    Call dentist                         │
│                                         │
│ 📬 2 urgent emails from Sarah           │
│                                         │
│ [Expand full briefing]                  │
├─────────────────────────────────────────┤
│ 🔴 NEEDS ATTENTION                      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ✉️ Email Draft                      │ │
│ │ To: appointments@smithdental.com    │ │
│ │ Re: Reschedule appointment          │ │
│ │                                     │ │
│ │ [Send]  [Edit]  [Discard]           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ❓ Friday's meeting with Sarah      │ │
│ │ She asked to reschedule. Options?   │ │
│ │                                     │ │
│ │ [Reschedule]  [Cancel]  [Ask her]   │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 📌 PINNED                               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Q1 Report                           │ │
│ │ Draft in progress · 60% complete    │ │
│ │ [Open]  [Unpin]                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ⏳ ARLO IS WORKING ON                   │
│                                         │
│ Researching flight options to Austin... │
│ ████████░░ Finding best prices          │
│                                         │
└─────────────────────────────────────────┘
```

### Secondary Tab: Activity Log

A separate tab (not cluttering the main desk) shows the full history:

```
┌─────────────────────────────────────────┐
│ [Desk]  [Activity]                      │
├─────────────────────────────────────────┤
│ 📜 ACTIVITY LOG                         │
│                                         │
│ Today                                   │
│ 2:34 PM  Sent email to Dr. Smith        │
│ 2:30 PM  Created task "Call Sarah"      │
│ 9:15 AM  Completed "Review PR #234"     │
│ 7:30 AM  Morning briefing delivered     │
│                                         │
│ Yesterday                               │
│ 6:00 PM  End-of-day summary             │
│ 4:12 PM  Rescheduled Friday meeting     │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## Desk Zones

### 1. Today (Always at Top)

The daily briefing — what you need to focus on. Updates throughout the day as things change.

**Contains:**

- Calendar overview (meetings, times)
- Tasks due today (with overdue flags)
- Urgent items surfaced from integrations (emails, Slack)
- Arlo's observations (optional, can expand)

**Behavior:**

- Auto-refreshes as day progresses
- Completed items fade/check off
- New urgent items appear
- Expands to full briefing detail on click

### 2. Needs Attention

Items requiring your decision or approval before Arlo can proceed.

**Contains:**

- Pending approvals (email drafts, calendar invites with others, Slack posts)
- Questions from Arlo ("Should I reschedule or cancel?")
- Flagged items Arlo thinks you should see

**Behavior:**

- Items have clear action buttons
- Acting on item resolves it (brief confirmation, then removed)
- Can dismiss/snooze ("Decide later")
- Sorted by urgency/age

### 3. Pinned

Items you've explicitly marked as priority. Tells Arlo "this matters to me."

**Contains:**

- Tasks you've pinned
- Documents/drafts in progress
- Anything you want persistent visibility on

**Behavior:**

- You control this zone (pin/unpin)
- Arlo can suggest pinning ("Want me to pin this?")
- Items stay until you unpin or complete them
- Arlo uses pinned items as context for prioritization

### 4. Arlo Is Working On

Visibility into async work Arlo is doing.

**Contains:**

- Current research/analysis in progress
- Long-running tasks (finding flights, compiling report)
- Background operations

**Behavior:**

- Shows progress indicator when meaningful
- Brief description of what's happening
- Can expand for more detail
- Disappears when complete (result goes to chat or spawns desk item)

---

## How Items Move

### Onto the Desk

**Arlo puts items on the desk:**

```
Arlo: "I drafted that email to reschedule. It's on our desk
       when you're ready."

→ Email draft card appears in "Needs Attention"
```

**Tools create desk items:**

```
createTask() → Task appears in "Today" if due today
draftEmail() → Draft appears in "Needs Attention"
startResearch() → Progress appears in "Working On"
```

**You pin items:**

```
[Click pin icon on any task/item]
→ Item appears in "Pinned" section
→ Arlo registers this as priority signal
```

### Off the Desk

**Approval given:**

```
[Click "Send" on email draft]
→ Card shows "Sent ✓" briefly
→ Fades out, logged to Activity
```

**Item completed:**

```
[Task marked complete]
→ Checkmark animation
→ Removed from Today, logged to Activity
```

**Dismissed:**

```
[Click "Discard" or "Nevermind"]
→ Item removed immediately
→ Logged to Activity as dismissed
```

**Day rolls over:**

```
→ Today section refreshes with new day
→ Yesterday's briefing archived to Activity
```

### Mutations on the Desk

Items are live objects. They update in place:

```
You: "Change the email to say 2pm instead of 3pm"

Arlo: "Updated the draft."

→ The email draft card already on desk reflects the change
→ No new card, just updated content
```

---

## Chat ↔ Desk Interaction

### Chat References Desk

Arlo can refer to items on the desk naturally:

```
Arlo: "The email draft on our desk — should I add the
       attachment Sarah mentioned?"

You: "Yes, and CC Mike on it"

Arlo: "Done. Updated the draft."
→ Desk card updates
```

### Desk Actions Can Open Chat Context

Clicking certain actions can prompt conversation:

```
[Click "Edit" on email draft]
→ Chat input focuses
→ Placeholder: "What would you like to change?"
```

Or for simple edits, inline editing on the card itself.

### Chat Without Desk

Not everything needs the desk. Informational responses stay in chat:

```
You: "What's on my calendar tomorrow?"

Arlo: "Tomorrow you have:
       - 10am: Team standup
       - 2pm: 1:1 with Sarah
       - 4pm: Dentist appointment"

→ Just chat, no desk item (unless you ask to pin it)
```

### Explicit Desk Requests

You can ask things to be put on the desk:

```
You: "Put my calendar for this week on the desk"

Arlo: "Added to your desk."
→ Week calendar view appears in Pinned
```

---

## Data Model Implications

### Desk Items Are First-Class Entities

Desk items aren't message content — they're independent objects:

```typescript
deskItem: {
  id: Id<'deskItems'>
  userId: Id<'users'>

  type: 'approval' | 'question' | 'briefing' | 'task' | 'draft' | 'progress'
  zone: 'today' | 'attention' | 'pinned' | 'working'

  // Type-specific data
  data: {
    // For approval: { draftId, actions: ['send', 'edit', 'discard'] }
    // For question: { question, options: [...] }
    // For task: { taskId }
    // For progress: { description, percent, operation }
  }

  // Metadata
  createdAt: number
  updatedAt: number
  createdBy: 'arlo' | 'user'
  priority: number

  // Resolution
  status: 'active' | 'resolved' | 'dismissed'
  resolvedAt?: number
  resolution?: string
}
```

### Relationship to Other Entities

Desk items often reference other entities:

- `task` desk item → links to task in `tasks` table
- `draft` desk item → links to draft in `emailDrafts` table
- `briefing` desk item → computed from calendar + tasks + activity

### Tool Design Pattern

Tools should declare their desk behavior:

```typescript
const draftEmail = tool({
  name: 'draftEmail',
  // ...
  deskBehavior: {
    creates: 'approval',
    zone: 'attention',
    actions: ['send', 'edit', 'discard'],
  },
})

const getCalendarEvents = tool({
  name: 'getCalendarEvents',
  // ...
  deskBehavior: null, // No desk item, just chat response
})
```

---

## Visual Design Principles

### Cards Are Interactive

Every card should feel manipulable:

- Clear action buttons
- Hover states
- Expandable detail
- Drag to reorder pinned items (maybe)

### Progressive Disclosure

Don't overwhelm. Show summary, expand for detail:

- Today section: collapsed by default, key numbers visible
- Email drafts: show to/subject, expand for body
- Tasks: show title/due, expand for notes

### Status Is Glanceable

Use visual hierarchy:

- 🔴 Red accent for needs attention
- 📌 Pin icon for user-prioritized
- ⏳ Animated indicator for in-progress
- ✓ Check for completed (briefly, then removed)

### Minimal Chrome

The desk should feel calm, not busy:

- Subtle section dividers
- Muted backgrounds
- Let content breathe
- No unnecessary decoration

---

## Open Questions

### To Resolve in Implementation

1. **Persistence across sessions** — Does the desk restore exactly on refresh, or recompute from state?

2. **Multiple drafts/approvals** — How many "Needs Attention" items before it feels overwhelming? Should we collapse?

3. **Mobile** — How does the desk work on small screens? Tab between chat and desk?

4. **Notifications** — If something appears on the desk while you're away, how do you know?

5. **Empty states** — What does the desk look like when there's nothing pending? Celebratory? Quiet?

### Future Possibilities

- **Desk templates** — Different desk layouts for different contexts (work mode, planning mode)
- **Shared desks** — If Arlo ever becomes multi-user, could two people share a desk?
- **Desk history** — "Show me what the desk looked like yesterday"
- **Voice** — "Hey Arlo, what's on our desk?"

---

## Relationship to Tool-UI

The [tool-ui](https://github.com/assistant-ui/tool-ui) library provides excellent component primitives:

- `ApprovalCard` → Needs Attention items
- `MessageDraft` → Email draft cards
- `ProgressTracker` → Working On section
- `DataTable` → Task lists, calendar views
- `OptionList` → Question cards with choices

We can adopt their component patterns while using our desk-based placement model instead of their inline-message model.

**Key difference:** Tool-UI renders components inline in chat. We render them in the persistent desk workspace, with chat as the coordination channel.

---

## Summary

The shared desk transforms Arlo from "chatbot with previews" to "chief of staff at your side."

- **Today** keeps you focused on what matters now
- **Needs Attention** surfaces decisions only you can make
- **Pinned** lets you signal priorities to Arlo
- **Working On** shows Arlo's async efforts
- **Activity Log** (secondary tab) provides full history

Chat becomes lighter — coordination and conversation — while the desk holds the actual work.

---

## Next Steps

1. **Prototype the desk layout** — Static mockup of zones and cards
2. **Define card components** — What each card type contains and does
3. **Design state model** — How desk items are stored and synced
4. **Implement Today section** — Start with the briefing card
5. **Add first approval flow** — Email draft as proof of concept
