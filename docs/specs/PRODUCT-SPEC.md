# Arlo Product Specification

> **Vision:** A personal AI assistant for work and life that regular people can use. Beautiful UI, proactive help, bidirectional task management between human and AI.

---

## Table of Contents

1. [What We're Building](#what-were-building)
2. [Core Principles](#core-principles)
3. [MVP (Weeks 1-4)](#mvp-weeks-1-4)
4. [Long-Term Vision](#long-term-vision)
5. [Technical Architecture](#technical-architecture)
6. [Data Model](#data-model)
7. [Arlo Agent Design](#arlo-agent-design)
8. [Integrations](#integrations)
9. [Open Questions](#open-questions)

---

## What We're Building

**Arlo** is a personal AI assistant that:

- Lives in a shared workspace with you (tasks, notes, chat)
- Can be assigned tasks and assigns tasks back to you
- Proactively surfaces things you'd miss (action items from email, upcoming deadlines, context)
- Connects to your tools (Gmail, Calendar, Slack, etc.)
- Works on desktop and mobile

**The key insight:** Arlo isn't a chatbot bolted onto a todo app. It's a peer who shares the same workspace. You create tasks. Arlo creates tasks. You complete tasks. Arlo completes tasks. Same data, same UI.

### Target User

Non-technical people who:

- Are overwhelmed managing tasks across email, calendar, Slack, etc.
- Want a personal assistant but can't afford or manage a human one
- Would never use a command line or configure an agent themselves

### First "Wow" Moment

User connects Gmail → Arlo surfaces 3 action items they missed → "Holy shit, that's useful."

Or: Arlo reminds them of something they forgot → saves their ass → trust established.

---

## Core Principles

1. **Proactive > Reactive** — The value is in things appearing before you ask, not in answering questions.

2. **Arlo is a peer, not a feature** — Same read/write access as the user. Tasks don't distinguish "human tasks" from "AI tasks" in structure, only in `createdBy`.

3. **Build as we use it** — Start scrappy, validate value, then polish. Don't build UI until we know what matters.

4. **Mobile matters** — Must be usable from phone from day 1. Can be web-based or Telegram initially.

5. **Trust is earned** — Arlo asks before taking external actions (sending emails, creating calendar events) until trust is established.

---

## MVP (Weeks 1-4)

### Goal

Validate that a proactive AI assistant sharing your task list actually makes life better. No beautiful UI needed—just functional.

### Architecture (MVP)

```
┌──────────────────────────────────────────────────────────┐
│                        CONVEX                            │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Database │  │  Scheduled   │  │  Arlo Actions     │  │
│  │          │  │  Functions   │  │  (agent runs here)│  │
│  │ tasks    │  │  (cron)      │  │                   │  │
│  │ messages │  │              │  │  - Claude API     │  │
│  │ activity │  │  "8am daily" │  │  - Tool execution │  │
│  │ instruct │  │  "hourly"    │  │  - DB read/write  │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│                                                          │
└─────────────────────────┬────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
      ┌──────────┐                ┌──────────┐
      │ Next.js  │                │ Telegram │
      │ (Vercel) │                │   Bot    │
      │          │                │ (Week 2) │
      │ Chat UI  │                │          │
      └──────────┘                └──────────┘
```

**Why this architecture:**

| Component             | Role                     | Rationale                                                                           |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| **Convex**            | Database + Agent runtime | Real-time sync, serverless functions, cron scheduling. Arlo runs as Convex actions. |
| **Next.js on Vercel** | Chat UI                  | Works on mobile browser. Vercel AI SDK for streaming. Instant deploys.              |
| **Telegram**          | Mobile access (optional) | Native push notifications. Already on your phone. Zero app to build.                |

### MVP Phases

#### Week 1: Foundation

**Day 1-2: Scaffold**

- Create Convex project
- Create Next.js app with Vercel AI SDK
- Basic chat UI (mobile-responsive)
- Messages stored in Convex

**Day 3-4: Arlo Basics**

- Convex action that calls Claude
- Basic tools: `createTask`, `listTasks`, `completeTask`, `createNote`
- System prompt with personality and instructions
- Wire chat to Arlo action

**Day 5-7: Task Management**

- Task list view in UI (simple, alongside chat)
- Assign tasks to Arlo via chat or UI
- Arlo can work on assigned tasks
- Activity log showing what Arlo did

**Deliverable:** Chat with Arlo on phone, assign tasks, see them persist.

#### Week 2: Proactive

**Goal:** Arlo does things without being asked.

- Scheduled functions in Convex (cron)
- Morning summary: "Here's what's due today"
- Reminder notifications when tasks are due
- (Optional) Add Telegram bot for native push notifications

**Deliverable:** Wake up to a summary from Arlo. Get reminded about due tasks.

#### Week 3: Gmail Integration

**Goal:** First real "wow" moment.

- Gmail OAuth flow (or use CLI tool like `gog`)
- Scheduled job: scan recent emails for action items
- Arlo creates tasks from emails (`source: "gmail"`)
- Notification: "Found 3 action items in your email"

**Deliverable:** Connect Gmail, see action items appear automatically.

#### Week 4: Live With It

- Use daily, notice gaps
- Add tools as needed (calendar, GitHub, etc.)
- Refine system prompt
- Decide: is this valuable enough to build a real UI?

### MVP Success Criteria

| Metric                                  | Target      |
| --------------------------------------- | ----------- |
| Daily active use (yourself)             | 7 days/week |
| Tasks created by Arlo                   | 5+/week     |
| "Arlo saved me" moments                 | 1+/week     |
| Proactive notifications that are useful | 50%+        |

---

## Long-Term Vision

### Architecture (Full)

```
┌─────────────────────────────────────────────────────────────┐
│                         CLOUD                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Convex    │  │  Arlo Core  │  │   Integrations      │  │
│  │  (Database) │  │   (Agent)   │  │  (Gmail, Cal, etc)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ Desktop  │     │  Mobile  │     │   Web    │
   │ (Tauri)  │     │  (Expo)  │     │          │
   └──────────┘     └──────────┘     └──────────┘
         │
         ▼
   ┌──────────────┐
   │ Local Agent  │  ← Optional power mode
   │ (heavy tasks)│
   └──────────────┘
```

### Full Product Features

#### Beautiful Task/Notes UI

A dedicated app (desktop + mobile) with:

- Sidebar: Today, Next 7 Days, Inbox, Projects, Arlo
- Task list with rich interactions (drag-drop, inline edit)
- Task detail panel (due dates, reminders, repeating, subtasks)
- Notes attached to tasks or standalone
- Rich text editing
- Dark/light themes
- Keyboard shortcuts
- Offline support with sync

#### Arlo Home

A dedicated view showing:

- Current status (what Arlo is working on)
- Queue (tasks assigned to Arlo)
- Scheduled prompts (recurring jobs)
- Instructions (what Arlo knows about you)
- Activity log (what Arlo has done)

#### Chat Interface

- Quick requests without creating tasks
- Back-and-forth clarification
- "What are you working on?"
- "Stop the current task"

#### Integrations

| Integration     | Capability                                         |
| --------------- | -------------------------------------------------- |
| Gmail           | Read emails, extract action items, draft responses |
| Google Calendar | Read events, create events, find free time         |
| Slack           | Read messages, send messages, extract action items |
| Linear          | Create issues, update status, read project state   |
| Notion          | Read/write pages, search workspace                 |
| GitHub          | Read issues/PRs, create issues, review PRs         |

User controls permissions per integration (read-only vs. read-write).

#### Hybrid Agent Model

**Cloud agent (default):**

- Runs as Convex actions
- Fast, always available
- Limited to ~5 minute execution time

**Local agent (power mode):**

- Runs on user's desktop
- For long-running tasks (research, complex analysis)
- Access to local files and apps
- Falls back to cloud when desktop offline

How it works:

1. Task assigned to Arlo
2. Convex determines: quick task or heavy task?
3. Quick → execute in Convex action
4. Heavy → queue for local agent
5. Local agent polls, executes, writes result back

#### Mobile App (Expo)

- Same Convex backend
- Core views: Today, Inbox, Projects, Chat
- Push notifications (reminders, Arlo alerts)
- Quick capture
- Offline support

#### Proactive Features

| Feature            | Trigger               | Action                                |
| ------------------ | --------------------- | ------------------------------------- |
| Morning briefing   | 8am daily             | Summary of today's tasks + calendar   |
| Email action items | Hourly                | Scan email, create tasks              |
| Deadline warning   | Task due soon         | Push notification                     |
| Weekly review      | Sunday evening        | Summary of week, prep for next        |
| Stale task nudge   | Task untouched 7 days | "Still relevant?" prompt              |
| Context surfacing  | Calendar event soon   | "You have 3 things about X this week" |

#### Learning & Memory

**Instructions (explicit):**

- User-defined facts: "I have two kids: Emma (7) and Jack (10)"
- Preferences: "Never schedule before 9am"
- Work context: "My manager is Sarah, we meet Tuesdays"

**Learned facts (inferred):**

- Arlo asks: "Should I remember this for future tasks?"
- User confirms → becomes instruction
- User can edit/delete anytime

---

## Technical Architecture

### Tech Stack

| Layer         | Technology                  | Rationale                                      |
| ------------- | --------------------------- | ---------------------------------------------- |
| Database      | Convex                      | Real-time sync, serverless functions, great DX |
| Desktop App   | Tauri                       | Small bundle, native feel, Rust performance    |
| Mobile App    | Expo                        | Cross-platform, fast iteration                 |
| Web UI (MVP)  | Next.js + Vercel AI SDK     | Fast to build, works on mobile                 |
| Agent Runtime | Convex Actions + Claude API | Serverless, scales automatically               |
| Local Agent   | Node.js + Claude API        | For heavy tasks, optional                      |
| Integrations  | Nango or Composio           | Managed OAuth, unified APIs                    |

### Convex Structure

```
convex/
├── schema.ts           # Database schema
├── tasks.ts            # Task CRUD
├── notes.ts            # Note CRUD
├── projects.ts         # Project CRUD
├── messages.ts         # Chat messages
├── arlo/
│   ├── agent.ts        # Main agent action
│   ├── tools.ts        # Tool definitions
│   ├── scheduler.ts    # Scheduled jobs
│   └── activity.ts     # Activity logging
├── integrations/
│   ├── gmail.ts        # Gmail integration
│   ├── calendar.ts     # Calendar integration
│   └── ...
└── http.ts             # HTTP endpoints (webhooks, Telegram)
```

---

## Data Model

### Schema (Convex)

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Projects (containers for tasks/notes)
  projects: defineTable({
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    section: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  }),

  // Tasks
  tasks: defineTable({
    projectId: v.optional(v.id('projects')),
    title: v.string(),
    body: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('completed')),
    assignee: v.optional(v.union(v.literal('user'), v.literal('arlo'))),
    due: v.optional(v.number()),
    reminders: v.optional(v.array(v.number())), // minutes before due
    repeat: v.optional(
      v.object({
        frequency: v.union(
          v.literal('daily'),
          v.literal('weekly'),
          v.literal('monthly'),
          v.literal('yearly')
        ),
        interval: v.number(),
        from: v.union(v.literal('due_date'), v.literal('completion_date')),
        days: v.optional(v.array(v.string())),
        dayOfMonth: v.optional(v.number()),
      })
    ),
    parentId: v.optional(v.id('tasks')),
    completedAt: v.optional(v.number()),
    sortOrder: v.number(),
    createdAt: v.number(),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    source: v.optional(v.string()), // "manual" | "gmail" | "calendar" | etc
  })
    .index('by_project', ['projectId'])
    .index('by_status', ['status'])
    .index('by_assignee', ['assignee'])
    .index('by_due', ['due']),

  // Notes
  notes: defineTable({
    projectId: v.optional(v.id('projects')),
    title: v.string(),
    body: v.optional(v.string()),
    taskId: v.optional(v.id('tasks')), // Attach to task
    sortOrder: v.number(),
    createdAt: v.number(),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    source: v.optional(v.string()),
  })
    .index('by_project', ['projectId'])
    .index('by_task', ['taskId']),

  // Chat messages
  messages: defineTable({
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    createdAt: v.number(),
  }).index('by_time', ['createdAt']),

  // Arlo instructions (persistent memory)
  instructions: defineTable({
    content: v.string(),
    category: v.optional(v.string()), // "personal" | "work" | "preferences"
    sortOrder: v.number(),
    createdAt: v.number(),
  }),

  // Scheduled prompts
  scheduledPrompts: defineTable({
    name: v.string(),
    prompt: v.string(),
    schedule: v.string(), // Cron expression
    enabled: v.boolean(),
    lastRun: v.optional(v.number()),
    createdAt: v.number(),
  }),

  // Activity log
  activity: defineTable({
    timestamp: v.number(),
    trigger: v.object({
      type: v.union(v.literal('task'), v.literal('scheduled'), v.literal('chat')),
      id: v.optional(v.string()),
    }),
    action: v.string(),
    outcome: v.union(v.literal('success'), v.literal('failure'), v.literal('needs_input')),
    details: v.optional(v.string()),
  }).index('by_time', ['timestamp']),

  // Integration connections
  integrations: defineTable({
    provider: v.string(), // "gmail" | "gcal" | "slack" | etc
    status: v.union(v.literal('connected'), v.literal('disconnected'), v.literal('error')),
    credentials: v.optional(v.string()), // Encrypted
    lastSync: v.optional(v.number()),
    config: v.optional(v.any()),
  }).index('by_provider', ['provider']),
})
```

---

## Arlo Agent Design

### System Prompt Structure

```typescript
const systemPrompt = `You are Arlo, a personal assistant who shares a workspace with the user.

## Your Capabilities
- Create, update, and complete tasks
- Create and edit notes
- Read email and extract action items (when Gmail connected)
- Check calendar and find conflicts (when Calendar connected)
- Remember facts and preferences via instructions

## Your Personality
- Helpful but not sycophantic
- Concise but thorough when needed
- Proactive—surface things the user might miss
- Honest about what you can and can't do

## Important Behaviors
- When you create a task from external source, always note the source
- When you're unsure, ask clarifying questions
- When completing a task, summarize what you did
- Never take external actions (send email, create event) without asking first

## Current Context
[Injected: user instructions, recent activity, relevant tasks]
`
```

### Tool Definitions

```typescript
const tools = [
  {
    name: 'createTask',
    description: 'Create a new task',
    parameters: {
      title: { type: 'string', required: true },
      body: { type: 'string' },
      projectId: { type: 'string' },
      due: { type: 'number', description: 'Unix timestamp' },
      assignee: { type: 'string', enum: ['user', 'arlo'] },
    },
  },
  {
    name: 'listTasks',
    description: 'List tasks with optional filters',
    parameters: {
      status: { type: 'string', enum: ['pending', 'completed', 'all'] },
      assignee: { type: 'string', enum: ['user', 'arlo', 'all'] },
      projectId: { type: 'string' },
      dueBefore: { type: 'number' },
    },
  },
  {
    name: 'completeTask',
    description: 'Mark a task as completed',
    parameters: {
      taskId: { type: 'string', required: true },
      summary: { type: 'string', description: 'What was done' },
    },
  },
  {
    name: 'updateTask',
    description: "Update a task's properties",
    parameters: {
      taskId: { type: 'string', required: true },
      title: { type: 'string' },
      body: { type: 'string' },
      due: { type: 'number' },
      assignee: { type: 'string' },
    },
  },
  {
    name: 'createNote',
    description: 'Create a note, optionally attached to a task',
    parameters: {
      title: { type: 'string', required: true },
      body: { type: 'string' },
      taskId: { type: 'string' },
      projectId: { type: 'string' },
    },
  },
  {
    name: 'searchEmails',
    description: 'Search recent emails (requires Gmail connection)',
    parameters: {
      query: { type: 'string' },
      maxResults: { type: 'number', default: 10 },
    },
  },
  {
    name: 'getCalendarEvents',
    description: 'Get upcoming calendar events (requires Calendar connection)',
    parameters: {
      daysAhead: { type: 'number', default: 7 },
    },
  },
  {
    name: 'remember',
    description: 'Save a fact or preference for future reference',
    parameters: {
      content: { type: 'string', required: true },
      category: { type: 'string', enum: ['personal', 'work', 'preferences'] },
    },
  },
]
```

### Agent Execution Flow

```
User sends message
        │
        ▼
Load context:
- User instructions
- Recent activity
- Relevant tasks (due soon, assigned to Arlo)
        │
        ▼
Build prompt:
- System prompt
- Context
- Chat history (last N messages)
- User message
        │
        ▼
Call Claude API with tools
        │
        ▼
┌─────────────────────────────────┐
│ Claude responds with:           │
│ - Text response                 │
│ - Tool calls (0 or more)        │
└───────────────┬─────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
   Has tool calls?   No tools
        │               │
        ▼               ▼
Execute tools      Return response
Write to DB        Save to messages
        │
        ▼
Return results to Claude
(loop until no more tool calls)
        │
        ▼
Final response
Save to messages
Log activity
```

---

## Integrations

### MVP: Gmail

**Setup:**

1. User clicks "Connect Gmail" in settings
2. OAuth flow via Nango (or direct Google OAuth)
3. Store refresh token (encrypted) in Convex

**Capabilities:**

- `searchEmails(query)` — Search recent emails
- `getEmail(id)` — Get full email content
- `extractActionItems(emails)` — Claude extracts tasks from emails

**Scheduled job (hourly):**

1. Fetch emails from last hour
2. Filter: unread, from humans (not automated)
3. Extract action items with Claude
4. Create tasks with `source: "gmail"`
5. Log activity

### Future: Calendar

**Capabilities:**

- `getEvents(start, end)` — List events in range
- `createEvent(...)` — Create calendar event (with user confirmation)
- `findFreeTime(duration, range)` — Find available slots

### Future: Slack

**Capabilities:**

- `searchMessages(query)` — Search Slack messages
- `getChannel(id)` — Get recent messages from channel
- `sendMessage(channel, text)` — Send message (with confirmation)

### Integration Authorization UI

```
Arlo Settings > Integrations

┌─────────────────────────────────────────────┐
│ Gmail                          [Connected] │
│ ├── ✓ Read emails                          │
│ ├── ✓ Search emails                        │
│ └── ○ Send emails (disabled)               │
│                                            │
│ Google Calendar                [Connect]   │
│                                            │
│ Slack                          [Connect]   │
│                                            │
│ Linear                         [Connect]   │
└─────────────────────────────────────────────┘
```

---

## Open Questions

### Product

1. **Trust model** — Does Arlo ask before every external action? Or learn over time which actions are safe?

2. **Task assignment UX** — How does user assign task to Arlo? Dropdown? Drag to Arlo? "@arlo" mention?

3. **Pricing** — Subscription? Per-task? Free tier? Too early to decide—build value first.

4. **Multi-user** — Family sharing? Team use? Defer for now.

### Technical

1. **Long-running tasks** — Convex actions have ~5 min limit. Need local agent for longer tasks?

2. **Offline** — How does offline work with cloud-first architecture? Convex handles some, but need to design UX.

3. **Cost management** — How to prevent runaway Claude API costs? Per-user limits? Token budgets?

4. **Security** — How to store integration credentials securely? Convex environment variables? External secrets manager?

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Convex account
- Anthropic API key
- (Optional) Vercel account for deployment

### Quick Start

```bash
# Create project
pnpm create convex@latest arlo
cd arlo

# Install dependencies
pnpm add @ai-sdk/anthropic ai convex

# Set up environment
echo "ANTHROPIC_API_KEY=sk-..." >> .env.local
echo "CONVEX_DEPLOYMENT=..." >> .env.local

# Start development
pnpm dev
```

### First Milestone

"I can chat with Arlo on my phone, ask it to create a task, and see the task persist."

### Second Milestone

"Arlo reminds me of a task I forgot about."

### Third Milestone

"Arlo found something in my email I would have missed."

---

## References

- [Convex Documentation](https://docs.convex.dev)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Anthropic Claude API](https://docs.anthropic.com)
- [Nango (Integrations)](https://www.nango.dev)
- [Tauri (Desktop)](https://tauri.app)
- [Expo (Mobile)](https://expo.dev)
