# Arlo Product Direction

> Captured from design exploration session, 2026-01-16

## The Core Insight

Arlo isn't a better task app or a better note app. It's **an AI that helps you actually get things done—including admitting when you won't.**

Most productivity tools assume you're a reliable executor. Create task → do task. But humans:

- Create tasks they'll never do
- Avoid tasks because they're too big or unclear
- Let lists grow until they're overwhelming and abandoned

A chief of staff doesn't just track tasks. They say:

- "This has been on your list for 3 weeks. Are you actually going to do this?"
- "This is too vague. What's the actual next step?"
- "I handled this for you. Here's what I did."
- "You have 47 tasks. Let's be honest about which 10 matter."

## The Three Pillars

To discover whether this is useful, we need:

1. **Tasks** — with real depth (hierarchy, details, subtasks, reminders)
2. **Notes** — document creation and editing
3. **Chief of Staff Agent** — daily check-ins, proactive management, honest pushback

These reinforce each other:

- Tasks give Arlo something to manage
- Notes give you a place to think (and Arlo context to reference)
- Chief of staff ties them together with judgment, not just tracking

## Data Model: Everything is a Page

Inspired by Notion's core insight—everything is a page—but radically simplified.

### The Model

```typescript
pages: {
  id: Id
  parentId: Id | null           // for nesting (areas → projects → items)
  type: "document" | "task" | "collection" | "bookmark" | "file"
  title: string
  content: string               // rich text / blocks

  // Task-specific (null for documents)
  status?: "pending" | "completed"
  dueDate?: number
  assignee?: "user" | "arlo"

  // Other type-specific fields
  url?: string                  // for bookmarks
  attachments?: FileId[]        // for files
  metadata?: Record<string, any>
}
```

### What This Enables

| Thing    | It's a page with...                             |
| -------- | ----------------------------------------------- |
| Task     | status, due date, assignee, subtasks as content |
| Document | just content                                    |
| Project  | collection of child pages                       |
| Bookmark | URL, auto-fetched preview                       |
| File     | attachment + extracted content for Arlo to read |

A task IS a page. Click it, it opens full-width with all details. The detail view problem dissolves—you just navigate into the page.

### The Hierarchy

```
Areas (collections)
└── Projects (collections)
    └── Tasks / Documents / Files (pages)
        └── Subtasks (checklist in content, or nested pages)
```

### Why Not Separate Tables?

Considered and rejected for personal tool scope:

- Performance is fine at hundreds/low thousands of items
- Unified model means unified search, unified Arlo access
- One codebase, one set of UI patterns
- Can always split later if needed

The tradeoff: less type safety, generic UI. Acceptable for discovering product-market fit.

## Solving the Blank Page Problem

The argument against "everything is a page": users face a blank page and don't know what to do.

Our answer: **Be opinionated about entry points, flexible about the container.**

Users don't think "create a page." They think:

- "Add a task" → clear action, Arlo helps refine it
- "Save this link" → clear action, Arlo extracts content
- "Quick capture" → dump thoughts, Arlo sorts them later
- "Write a note" → starts with context Arlo provides

The page model lives underneath, but the UI guides users into specific actions.

And critically: **Arlo fills the page first.** You don't stare at an empty task list—Arlo already surfaced action items from your email. The page isn't blank because your AI peer started working.

## Chief of Staff Behaviors

The chief of staff isn't a feature—it's personality and behaviors that make tasks and notes useful.

| Behavior          | What Arlo Does                                                   |
| ----------------- | ---------------------------------------------------------------- |
| Morning check-in  | "Here's your day. 3 tasks due, 1 meeting. What's your priority?" |
| Task grooming     | "This has been here 2 weeks. Still relevant?"                    |
| Task breakdown    | "This seems big. Want to break it into steps?"                   |
| Proactive capture | Surfaces action items from notes you write                       |
| Honest pushback   | "You have 12 tasks due today. That's not realistic."             |
| End of day        | "You completed 4 things. Here's what's rolling to tomorrow."     |
| Do things for you | Actually completes tasks when possible                           |

The daily check-in is the heartbeat. It's where trust gets built or broken.

## Visible AI Configuration

Insight from Claude Code: the magic (agents, skills, CLAUDE.md) is hidden. Normal people need to see the machinery to understand and trust it.

The "Arlo Settings" should surface the CLAUDE.md equivalent:

```
Arlo Settings
├── Personality     "Direct, not sycophantic. Proactive."
├── Instructions    "I work at Acme. My manager is Sarah."
├── Skills          [checkbox] Task management
│                   [checkbox] Email triage
│                   [checkbox] Calendar awareness
├── Agents          Finance Agent → "Categorize bank statements"
│                   Research Agent → "Deep dive on topics"
└── Activity        [what Arlo has done, transparent log]
```

Users see the machinery. They can edit it. The magic becomes understandable and trustworthy.

## Layout Architecture

Mode-based layout with persistent Arlo panel:

```
┌─────────┬────────────────────────────────┬─────────────┐
│ Icon    │                                │             │
│ Rail    │     Main Area (mode-based)     │   Arlo      │
│         │                                │   Panel     │
│ [chat]  │  Tasks mode: page tree + page  │   (chat +   │
│ [tasks] │  Docs mode: page tree + editor │   context)  │
│ [docs]  │                                │             │
│ [arlo]  │                                │             │
└─────────┴────────────────────────────────┴─────────────┘
```

- Icon rail switches modes
- Each mode has its own layout in main area
- Arlo panel is persistent, collapsible, context-aware
- Arlo sees what you're looking at and can help in context

## What We're Building vs. What We're Prototyping

**Building (personal tool):**

- Tasks with depth
- Notes/documents
- Chief of staff behaviors
- Page-based data model

**Prototyping (platform hypothesis):**

- Can visible AI configuration make agents trustworthy for normal people?
- Does an AI that kills tasks you won't do change behavior?
- Is "chief of staff" the right metaphor?

## Next Steps

1. **Task depth** — hierarchy, details view, subtasks, due dates
2. **Notes** — basic document editing in the page model
3. **Scheduled check-ins** — the cron jobs that make Arlo proactive
4. **Visible AI config** — instructions/personality you can edit

The scheduled check-in might be the fastest way to feel whether chief of staff has legs. You can fake task depth (manually add detail), but you can't fake the proactive relationship.

---

## Appendix: Steelman Against Pages

For reference, arguments against the unified page model:

1. **Performance at scale** — one table with all types, filtering is expensive
2. **Schema chaos** — flexible metadata becomes a junk drawer
3. **Generic UI** — purpose-built task UIs (Things 3, Linear) are better
4. **Relationships** — parent-child doesn't capture all relationships (multi-project tasks)
5. **Files are different** — blob storage, streaming, extraction are special
6. **Blank page problem** — users don't know what to do (mitigated by opinionated entry points)
7. **Type-specific behaviors multiply** — tasks, docs, bookmarks need different features

These matter more for a platform. For a personal tool discovering value, simplicity wins.
