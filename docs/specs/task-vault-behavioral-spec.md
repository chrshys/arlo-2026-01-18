# Task Vault Behavioral Specification

> **Purpose:** This document describes _what_ Task Vault does, not _how_ it's implemented. Use this as a reference for building the app.

---

## Overview

Task Vault is a task and notes app backed by Convex. Tasks and notes live inside projects, support due dates, reminders, and repeating schedules. Data syncs in real-time across devices. Both users and Arlo (the AI agent) read and write to the same backend.

---

## Data Model

### Tables

**projects**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | Id | Convex document ID |
| `name` | string | Project name |
| `icon` | string? | Emoji or icon name |
| `color` | string? | Theme color |
| `section` | string? | Section name (null = default section) |
| `sortOrder` | number | Position in sidebar |
| `createdAt` | number | Unix timestamp |
| `createdBy` | string | `"user"` or `"arlo"` |

**tasks**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | Id | Convex document ID |
| `projectId` | Id | Reference to project |
| `title` | string | Task title |
| `body` | string | Rich text content |
| `status` | string | `"pending"` or `"completed"` |
| `due` | number? | Unix timestamp |
| `reminders` | number[]? | Minutes before due to remind |
| `repeat` | RepeatConfig? | Repeat configuration |
| `parentId` | Id? | Parent task (for subtasks) |
| `completedAt` | number? | When completed |
| `previousInstanceId` | Id? | Link to previous repeat instance |
| `sortOrder` | number | Position in list |
| `createdAt` | number | Unix timestamp |
| `createdBy` | string | `"user"` or `"arlo"` |
| `source` | string? | Origin: `"manual"`, `"email"`, `"granola"`, etc. |

**notes**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | Id | Convex document ID |
| `projectId` | Id | Reference to project |
| `title` | string | Note title |
| `body` | string | Rich text content |
| `parentId` | Id? | Associated task |
| `sortOrder` | number | Position in list |
| `createdAt` | number | Unix timestamp |
| `createdBy` | string | `"user"` or `"arlo"` |
| `source` | string? | Origin |

**sections**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | Id | Convex document ID |
| `name` | string | Section name |
| `sortOrder` | number | Position in sidebar |

**RepeatConfig**

```typescript
{
  frequency: "daily" | "weekly" | "monthly" | "yearly"
  interval: number        // e.g., 2 for "every 2 weeks"
  from: "due_date" | "completion_date"
  days?: string[]         // for weekly: ["mon", "wed", "fri"]
  dayOfMonth?: number     // for monthly: 15
}
```

### Special Concepts

**Inbox**: A built-in project that always exists. Used for quick capture without project assignment. Cannot be deleted or renamed.

**Default Section**: Projects without a `section` value appear in the default section. The section name is configurable per user.

**created_by**: Every item tracks who created it. `"user"` means created via Task Vault UI. `"arlo"` means created by the AI agent.

**source**: Optional field tracking where an item originated. Useful for items Arlo creates from ingested content (email, meeting transcripts, etc.).

---

## Views

### Today

Shows incomplete tasks where `due` is today (midnight to midnight, user's timezone).

- Excludes completed tasks
- Groups by project
- Shows task count in sidebar badge

### Next 7 Days

Shows incomplete tasks due within the next 7 days (starting tomorrow).

- Excludes completed tasks
- Groups by due date
- Shows task count in sidebar badge

### Inbox

Shows all items in the Inbox project.

- Used for quick capture without project assignment
- Items can be dragged to other projects

### Project

Shows all tasks and notes within a selected project.

- Displays in sortOrder
- Completed tasks shown in collapsible "Completed" section (if enabled in settings)
- Supports inline task creation

---

## Task Behaviors

### Completion

1. User taps checkbox
2. `status` changes from `"pending"` to `"completed"`
3. `completedAt` set to current timestamp
4. If task has `repeat` config → create next instance (see Repeating)
5. Task moves to "Completed" section in list

### Uncomplete

1. User taps checkbox on completed task
2. `status` changes to `"pending"`
3. `completedAt` cleared

### Repeating Tasks

When a repeating task is completed:

1. Calculate next due date based on `repeat.from`:
   - `due_date`: Add interval to the original due date
   - `completion_date`: Add interval to now
2. Create new task with:
   - Same title, body, project, reminders, repeat config
   - New due date
   - `previousInstanceId` set to completed task's ID
3. Original task remains completed (historical record)

**Repeat frequencies:**

- `daily`: Every N days
- `weekly`: Every N weeks, optionally on specific days
- `monthly`: Every N months, optionally on specific day of month
- `yearly`: Every N years

### Subtasks

Tasks can have subtasks via the `parentId` field.

- Subtasks display indented under parent in task list
- Completing parent does NOT auto-complete subtasks
- Subtasks can have their own due dates, reminders, etc.

---

## Reminders

### Configuration

- `reminders` field is an array of minute offsets before due time
- Requires `due` to include a time (not just date)
- Common offsets: 0 (at time), 15, 30, 60, 180, 1440 (1 day)

### Behavior

1. Convex cron job checks for due reminders
2. Sends push notification to user's devices:
   - Title: Task title
   - Body: "Due in 15 min" / "Due now" / etc.
3. Tapping notification opens app and selects the task
4. Reminders not sent for completed tasks

---

## Drag and Drop

### Task Reordering

Drag tasks within a list to change `sortOrder`.

### Move Task to Project

Drag task to a project in the sidebar:

1. Update task's `projectId`
2. Preserve all other fields

### Project Reordering

Drag projects within a section to change `sortOrder`.

### Move Project to Section

Drag project to a section header:

1. Update project's `section` field

### Section Reordering

Drag section headers to reorder (update `sortOrder` on sections).

---

## UI Layout

### Desktop

```
┌─────────────────────────────────────────────────────────┐
│ Traffic Lights              Title Bar                   │
├──────────────┬─────────────────────┬────────────────────┤
│              │                     │                    │
│   Sidebar    │     Task List       │   Task Detail      │
│   (256px)    │    (flexible)       │    (flexible)      │
│              │                     │                    │
│ • Today (3)  │ ☐ Task one          │ Title: Task one    │
│ • Next 7 (5) │ ☐ Task two          │ Due: Jan 20, 2pm   │
│ • Inbox      │ ☑ Task three        │ Reminders: 30min   │
│              │                     │ Repeat: Weekly     │
│ ▼ Work       │ + Add task...       │                    │
│   Project A  │                     │ [Rich text body]   │
│   Project B  │                     │                    │
│ ▼ Personal   │                     │ Subtasks:          │
│   Home       │                     │ ☐ Subtask 1        │
│              │                     │                    │
│ + Project    │                     │ [Delete] [To Note] │
└──────────────┴─────────────────────┴────────────────────┘
```

### Sidebar States

- **Expanded** (256px): Full project tree with names
- **Collapsed** (78px): Icons only

### Panel Resizing

- Drag dividers between panels to resize
- Minimum widths enforced
- Sizes persisted locally

### Mobile

- Single column view
- Bottom tab navigation or hamburger menu
- Either task list OR task detail visible (not both)
- Swipe gestures for common actions (complete, delete)

### Focus Mode

- Full-screen task detail view
- Toggle button in task detail header
- Hides sidebar and task list

---

## Context Menus

### Task Row

- Delete task
- Convert to note
- Set due date
- Move to project → [project list]

### Project (Sidebar)

- Rename
- Delete (with confirmation)
- Move to section → [section list]

### Section Header

- Rename
- Delete (moves projects to default section)
- Add project

---

## Settings

### User Settings (stored in Convex)

| Setting              | Type    | Default    | Description                       |
| -------------------- | ------- | ---------- | --------------------------------- |
| `theme`              | enum    | system     | light / dark / system             |
| `showCompleted`      | boolean | true       | Show completed tasks in lists     |
| `defaultReminder`    | number  | 30         | Default reminder offset (minutes) |
| `defaultSectionName` | string  | "Projects" | Name for the default section      |

### Device Settings (stored locally)

| Setting            | Type    | Default | Description             |
| ------------------ | ------- | ------- | ----------------------- |
| `sidebarCollapsed` | boolean | false   | Sidebar state           |
| `panelSizes`       | object  | -       | Panel width percentages |

---

## Keyboard Shortcuts (Desktop)

| Shortcut         | Action           |
| ---------------- | ---------------- |
| Cmd/Ctrl+N       | Quick add task   |
| Cmd/Ctrl+Shift+N | Quick add note   |
| Cmd/Ctrl+Z       | Undo             |
| Cmd/Ctrl+Shift+Z | Redo             |
| Escape           | Close modal/menu |

---

## Sync & Offline

### Real-time Sync

- All changes sync immediately via Convex
- Multiple devices see updates in real-time
- No manual refresh needed

### Offline Support

- App works offline with cached data
- Changes queue locally
- Sync automatically when connection restored
- Conflict resolution: last-write-wins

### Arlo Integration

- Arlo reads/writes to the same Convex tables
- Tasks created by Arlo have `createdBy: "arlo"`
- Tasks from ingestion have `source` indicating origin
- No special API—Arlo is just another client

---

## Display Formatting

### Due Date Badge

| Condition         | Color    |
| ----------------- | -------- |
| Overdue           | Red      |
| Due today         | Red      |
| Due within 7 days | Orange   |
| Due later         | Gray     |
| No due date       | No badge |

### Task Row

```
☐ Task title                      Jan 20  🔔  ↻  👤
│  │                                │     │   │   │
│  └─ Title (truncated if long)     │     │   │   └─ Created by (if Arlo)
│                                   │     │   └─ Repeat indicator
│                                   │     └─ Reminder indicator
└─ Checkbox                         └─ Due date badge
```

### Counts

- Sidebar badges show pending (not completed) task counts
- Project row shows count of pending tasks in that project
- Today/Next 7 badges show relevant task counts

### Arlo Indicator

Tasks created by Arlo show a subtle indicator (icon or label) so users know the origin. Optional: filter to show only user-created or only Arlo-created items.

---

## What This Spec Doesn't Cover

- Implementation details (React components, Convex schema syntax, etc.)
- Animation specifics
- Exact pixel dimensions
- Color palette / design tokens
- Error handling edge cases
- Arlo's ingestion logic (that's Arlo's spec, not Task Vault's)
- Markdown export feature (future consideration)

These are implementation decisions for the build.
