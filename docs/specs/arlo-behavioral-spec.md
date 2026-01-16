# Arlo Behavioral Specification

> **Purpose:** This document describes _what_ Arlo does, not _how_ it's implemented. Use this as a reference for building the agent system.

---

## Overview

Arlo is an AI agent that shares the same Convex backend as Task Vault. He can be assigned tasks, run scheduled prompts, remember instructions, and take actions on your behalf. Arlo is a peer—not a feature—with the same read/write access to the vault as you.

**Core principle:** Arlo should be able to do anything you could do if you had unlimited time and patience. Research, organize, communicate, automate.

---

## Concepts

### Tasks

Work items that Arlo is assigned to complete. Tasks have a clear completion state.

**Examples:**

- "Summarize all my subscriptions from email and bank statements"
- "Research vacation spots in Portugal for a family of 4"
- "Draft a response to the email from John about the project timeline"

When Arlo completes a task, he updates it with his findings and either:

- Marks it complete (if no human review needed)
- Reassigns to user for review (if approval/decision needed)

### Instructions

Persistent facts and preferences that Arlo always has access to. Instructions don't complete—they shape how Arlo behaves.

**Examples:**

- "I have two kids: Emma (7) and Jack (10)"
- "My work email is chris@company.com, personal is chris@gmail.com"
- "I prefer morning meetings, never schedule anything before 9am"
- "When creating calendar events, always add a 15-minute buffer"

Instructions are the "system prompt" for your life. Arlo references them when executing any task or scheduled prompt.

### Scheduled Prompts

Recurring jobs that run on a time-based schedule. A scheduled prompt is a prompt + a cron expression.

**Examples:**

- "Every Monday 7am: Check email for school newsletters, extract events for the kids, add to family calendar"
- "Every Sunday 6pm: Review my week ahead and create a 'Weekly Preview' note with key priorities"
- "Daily 8am: Check if any tasks are due today and send me a summary via notification"

When a scheduled prompt runs, Arlo executes the prompt and may:

- Take actions directly (add calendar events, send messages)
- Create tasks for human review
- Create notes with findings
- Send notifications

### Activity Log

A record of everything Arlo has done. Every action Arlo takes is logged with:

- Timestamp
- What triggered it (task, scheduled prompt, or direct request)
- What actions were taken
- Outcome (success, failure, needs input)

The activity log provides transparency into Arlo's autonomous work.

---

## Data Model

### arlo_instructions

| Field       | Type    | Description                                          |
| ----------- | ------- | ---------------------------------------------------- |
| `_id`       | Id      | Convex document ID                                   |
| `content`   | string  | The instruction text                                 |
| `category`  | string? | Optional grouping: "personal", "work", "preferences" |
| `sortOrder` | number  | Display order                                        |
| `createdAt` | number  | Unix timestamp                                       |
| `updatedAt` | number  | Last modified                                        |

### arlo_scheduled_prompts

| Field       | Type    | Description                          |
| ----------- | ------- | ------------------------------------ |
| `_id`       | Id      | Convex document ID                   |
| `name`      | string  | Human-readable name                  |
| `prompt`    | string  | The prompt to execute                |
| `schedule`  | string  | Cron expression                      |
| `enabled`   | boolean | Whether the prompt is active         |
| `lastRun`   | number? | Unix timestamp of last execution     |
| `nextRun`   | number? | Unix timestamp of next scheduled run |
| `createdAt` | number  | Unix timestamp                       |

### arlo_activity

| Field        | Type    | Description                                   |
| ------------ | ------- | --------------------------------------------- | ----------- | -------------------- |
| `_id`        | Id      | Convex document ID                            |
| `timestamp`  | number  | When this happened                            |
| `trigger`    | object  | What caused this: `{ type: "task"             | "scheduled" | "direct", id?: Id }` |
| `action`     | string  | What Arlo did                                 |
| `outcome`    | string  | `"success"`, `"failure"`, `"needs_input"`     |
| `details`    | string? | Additional context or error message           |
| `relatedIds` | Id[]?   | Tasks, notes, or other items created/modified |

### arlo_state

| Field           | Type    | Description                                  |
| --------------- | ------- | -------------------------------------------- |
| `_id`           | Id      | Convex document ID                           |
| `status`        | string  | `"idle"`, `"working"`, `"waiting_for_input"` |
| `currentTaskId` | Id?     | Task currently being worked on               |
| `currentPrompt` | string? | What Arlo is currently doing                 |
| `startedAt`     | number? | When current work started                    |
| `queue`         | Id[]    | Tasks waiting to be worked on                |

---

## Triggers

What causes Arlo to act?

### Task Assignment

When a task is assigned to Arlo (via `assignee: "arlo"` or moved to an Arlo project), it enters Arlo's queue.

**Behavior:**

1. Task enters queue
2. Arlo picks up tasks in queue order (or by priority if specified)
3. Arlo works on one task at a time
4. On completion, Arlo picks up the next queued task

### Scheduled Prompts

Convex cron triggers scheduled prompts at their specified times.

**Behavior:**

1. Cron fires at scheduled time
2. Arlo executes the prompt
3. Results are logged to activity
4. Any created tasks/notes appear in the vault

### Direct Request (Future)

Arlo could be triggered by direct message (via Telegram, in-app chat, etc.). This is a future consideration—for now, focus on task assignment and scheduled prompts.

---

## Memory Model

Arlo's memory has three layers:

### Layer 1: Instructions (Explicit)

User-defined facts and preferences stored in `arlo_instructions`. These are always available to Arlo when executing any work.

**Characteristics:**

- User creates and edits directly
- Organized by category
- Always included in Arlo's context

### Layer 2: Conversation Context (Session)

When Arlo works on a task, he maintains context for that task's "session." This includes:

- The task details
- Any back-and-forth clarification
- Research findings gathered during work

**Characteristics:**

- Scoped to a single task
- Persisted in task body/notes
- Cleared when task completes

### Layer 3: Learned Facts (Inferred)

When Arlo learns something through interaction, he can create new instructions.

**Example flow:**

1. Arlo working on school calendar task
2. Arlo: "What grades are your kids in?"
3. User: "Emma is in 2nd grade, Jack is in 5th"
4. Arlo creates instruction: "Emma is in 2nd grade (age 7), Jack is in 5th grade (age 10)"
5. This fact is now available for all future work

**Characteristics:**

- Created by Arlo with user confirmation
- User can edit/delete
- Becomes part of Layer 1

---

## Learning Loop

How Arlo asks questions and remembers answers.

### During Task Execution

When Arlo needs information to complete a task:

1. Arlo updates task with a question
2. Task status becomes `"waiting_for_input"`
3. User sees the question in Task Vault (and optionally via notification)
4. User responds (via task comments or direct reply)
5. Arlo continues execution

### Promoting to Instruction

If the answer is reusable (a fact about you, a preference):

1. Arlo asks: "Should I remember this for future tasks?"
2. If yes, Arlo creates an instruction
3. User can review/edit in Arlo's instruction panel

### Example

```
Task: "Find relevant school events for my kids"

Arlo: I found the school newsletter. Which kids should I
      track events for? And what activities are they in?

User: Emma (2nd grade) - soccer and art club
      Jack (5th grade) - basketball and robotics

Arlo: Got it. Should I remember this for future school-related tasks?

User: Yes

→ Arlo creates instruction:
  "Kids' school activities:
   - Emma (2nd grade): soccer, art club
   - Jack (5th grade): basketball, robotics"

→ Arlo continues, now filtering events by these activities
```

---

## Tool System

What Arlo can do. Tools are capabilities Arlo can invoke during execution.

### Core Tools

| Tool                       | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `vault.createTask`         | Create a new task in any project                  |
| `vault.updateTask`         | Update task title, body, status, due date, etc.   |
| `vault.createNote`         | Create a note in any project                      |
| `vault.search`             | Search tasks and notes in the vault               |
| `memory.getInstructions`   | Retrieve all user instructions                    |
| `memory.createInstruction` | Create a new instruction (with user confirmation) |
| `notify.send`              | Send a push notification to the user              |

### External Tools (via MCP or CLI)

Arlo can use external tools through a plugin system. Each tool is:

- Explicitly enabled by the user
- Sandboxed with defined permissions
- Logged in activity

**Example tools:**
| Tool | Description |
|------|-------------|
| `email.search` | Search email by query |
| `email.read` | Read email content |
| `calendar.create` | Create calendar event |
| `calendar.list` | List upcoming events |
| `browser.fetch` | Fetch and parse a web page |
| `browser.search` | Search the web |
| `linear.createIssue` | Create a Linear issue |
| `github.createPR` | Create a GitHub pull request |

### Tool Authorization

Users control what Arlo can access:

```
Arlo Tools & Permissions
├── Email (Gmail)
│   ├── ✓ Read emails
│   ├── ✓ Search emails
│   └── ✗ Send emails (disabled)
├── Calendar (Google)
│   ├── ✓ Read events
│   └── ✓ Create events
├── Linear
│   └── ✓ Full access
└── GitHub
    ├── ✓ Read repositories
    └── ✗ Push code (disabled)
```

### Adding New Tools

Tools can be added via:

1. **MCP servers** - Standard protocol for AI tool use
2. **CLI wrappers** - Arlo can execute CLI tools (gh, linear, etc.)
3. **HTTP APIs** - Direct API calls with stored credentials

The tool system is extensible—new integrations don't require changes to Arlo's core.

---

## Progress & Transparency

How you see what Arlo is doing.

### Arlo View in Task Vault

A dedicated view showing:

**Current Status**

- What Arlo is working on right now
- Progress indicator (if available)
- Time elapsed

**Queue**

- Tasks waiting for Arlo
- Estimated position/wait

**Recent Activity**

- Log of recent actions
- Expandable details
- Links to created/modified items

### Task-Level Transparency

When Arlo works on a task, the task body shows:

- What Arlo did
- What tools he used
- What he found
- Any errors or blockers

This creates an audit trail directly in the task.

### Notifications

Arlo can notify you of:

- Task completion
- Questions requiring input
- Scheduled prompt results (if configured)
- Errors or failures

Notification preferences are configurable per-trigger.

---

## Task Assignment

How tasks get assigned to Arlo.

### Explicit Assignment

Set `assignee: "arlo"` on a task. This can happen via:

- Dropdown in task detail
- Drag to "Arlo" in sidebar
- Context menu → "Assign to Arlo"

### Arlo Project

Optionally, a special "Arlo" project where any task created is automatically assigned to Arlo. Like an inbox, but for agent work.

### Task Requirements for Arlo

For Arlo to work on a task effectively, it should have:

- Clear title describing the goal
- Sufficient context in body (or Arlo will ask)
- Any relevant attachments or links

Arlo will ask clarifying questions if the task is ambiguous.

---

## Execution Model

How Arlo actually does work.

### Sequential Processing

Arlo works on one task at a time. This keeps context focused and prevents conflicts.

**Queue behavior:**

1. Tasks enter queue when assigned
2. Arlo picks up highest priority (or oldest if no priority)
3. Works until complete or blocked
4. Moves to next task

### Execution States

| State               | Description                         |
| ------------------- | ----------------------------------- |
| `idle`              | No work in queue                    |
| `working`           | Actively executing a task or prompt |
| `waiting_for_input` | Blocked on user response            |
| `error`             | Failed, needs attention             |

### Timeout & Limits

- Tasks have a maximum execution time (configurable, default 10 minutes)
- If exceeded, Arlo pauses and reports progress
- User can extend or cancel

### Error Handling

When Arlo encounters an error:

1. Log the error with details
2. Set task to `waiting_for_input` with error context
3. Notify user (if configured)
4. Move to next task in queue (don't block on errors)

---

## Arlo's Home in Task Vault

The UI surface for managing Arlo.

### Sidebar Entry

Arlo appears in the sidebar like a smart view:

```
Today (3)
Next 7 Days (5)
Inbox
─────────────
Arlo
  → Working on: "Research Portugal trips"
─────────────
▼ Work
  Project A
  ...
```

Clicking "Arlo" opens the Arlo view.

### Arlo View Layout

```
┌─────────────────────────────────────────────────────────┐
│ Arlo                                            [⚙️]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Status: Working                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📋 Research vacation spots in Portugal              │ │
│ │    Started 3 min ago · Using: browser, search       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Queue (2)                                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☐ Summarize subscriptions                           │ │
│ │ ☐ Draft email to contractor                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Scheduled Prompts                              [+ Add]  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📅 School calendar sync         Mon 7am    ✓ On     │ │
│ │ 📅 Weekly review prep           Sun 6pm    ✓ On     │ │
│ │ 📅 Daily task summary           Daily 8am  ○ Off    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Instructions                                   [Edit]   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 Personal                                         │ │
│ │    "I have two kids: Emma (7) and Jack (10)..."     │ │
│ │ 💼 Work                                             │ │
│ │    "My work email is chris@company.com..."          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Recent Activity                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 10:32am  Added 3 events to family calendar          │ │
│ │ 10:30am  Ran "School calendar sync"                 │ │
│ │ Yesterday  Completed "Find pediatrician options"    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Settings (⚙️)

- Tool permissions
- Notification preferences
- Execution limits
- Connected accounts

---

## Communication with Arlo

How you interact with Arlo beyond task assignment.

### In-App (V1)

- Assign tasks with context in body
- Respond to questions via task comments
- Review Arlo's work in task body

### Chat Interface (Future)

A conversational interface within Task Vault:

- Quick requests without creating tasks
- Back-and-forth clarification
- "What are you working on?"
- "Stop the current task"

### External Channels (Future)

Same Arlo, accessible via:

- Telegram
- iMessage
- Slack

All channels read/write to the same vault.

---

## What This Spec Doesn't Cover

- Implementation details (agent runtime, LLM selection, prompt engineering)
- Specific MCP server configurations
- Authentication flows for external services
- Rate limiting and cost management
- Multi-user / family sharing scenarios
- Voice interface
- Exact notification copy/UX

These are implementation decisions for the build.

---

## Open Questions

1. **Task priority** - How does Arlo decide which task to work on next? FIFO? Explicit priority field? Due date?

2. **Partial completion** - If Arlo makes progress but can't finish, how is that represented? Draft state?

3. **Arlo-created tasks** - When Arlo creates a task (from a scheduled prompt), should it auto-assign to user? Or be unassigned?

4. **Instruction conflicts** - If instructions contradict each other, how does Arlo handle it?

5. **Cost visibility** - Should users see token/API usage per task?

6. **Undo** - If Arlo takes an action (creates calendar event), can it be undone?
