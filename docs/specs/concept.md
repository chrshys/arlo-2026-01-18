# Task Vault + Arlo: Concept Doc

## What We're Building

A task and notes app (Vault) that you and your AI agent (Arlo) both use. You create tasks. Arlo creates tasks. You complete tasks. Arlo completes tasks and logs what it did. Same data, multiple interfaces.

## The Core Idea

**Task Vault** is a UI for managing tasks and notes. It runs on desktop and mobile.

**Arlo** is an AI agent that works on your behalf. He can read your tasks, create new ones, do research, send reminders, and absorb content from emails, meeting transcripts, documents, etc.

**Convex** is the shared backend. Both you (via Task Vault) and Arlo (via various interfaces) read and write to the same database.

```
                    ┌─────────────┐
                    │   Convex    │
                    │  (backend)  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    Task Vault         Telegram         Claude Code
    (you)              (you + Arlo)     (you + Arlo)
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
                    Both read/write
                    to the same tasks
```

## Why This Architecture

1. **Sync without complexity** - Convex handles real-time sync across devices
2. **Agent-native** - Arlo doesn't need special APIs; he uses the same data you do
3. **Interface-agnostic** - Add new surfaces (voice, web, watch) without changing the backend
4. **Content absorption** - Ingested content (emails, transcripts) becomes tasks and notes in the same system

## What Task Vault Does

- Manage tasks with due dates, reminders, and repeating schedules
- Organize tasks into projects and sections
- Capture notes
- Show what's due today, this week, overdue
- Work offline (sync when reconnected)
- Display who created each item (you or Arlo)

## What Arlo Does

- Watch content sources (email, Granola, calendar, etc.)
- Extract action items and create tasks
- Send reminders via Telegram/notifications
- Do research and attach findings to tasks
- Surface context proactively ("You have 3 things at the kids' school this week")
- Complete tasks autonomously when appropriate

## Content Flow

```
Email about school event
        │
        ▼
  Arlo ingests it
        │
        ▼
Task: "Field trip Friday - pack lunch"
  due: Friday 7am
  created_by: arlo
  source: email
        │
        ▼
Appears in Task Vault + Telegram reminder Thursday night
```

## Key Principles

1. **Convex is the source of truth** - Not local files. Markdown export is optional, for Claude Code integration.

2. **Mobile matters** - Quick capture on phone is essential. Desktop is for heavy management.

3. **Arlo is a peer, not a feature** - He has the same read/write access you do. Tasks don't distinguish "human tasks" from "agent tasks" in structure, only in `created_by`.

4. **Proactive > reactive** - The value is in things appearing before you ask, not in querying.

5. **Simple data model** - Tasks, notes, projects. No overengineering. Add complexity only when needed.

6. **Offline-capable** - Task Vault works without internet. Syncs when connected.

---

## Glossary

**Task Vault**
The UI application for tasks and notes. Desktop (Electron) and mobile (Expo). The "todo app you like."

**Arlo**
Your AI agent. Persistent, proactive, personalized. Available via multiple interfaces (Telegram, Claude Code, potentially Task Vault chat). Creates tasks, does research, sends reminders.

**Convex**
The backend database and serverless platform. Stores all tasks, notes, projects, and memories. Handles real-time sync. Runs scheduled jobs (cron) for reminders and proactive actions.

**Project**
A container for related tasks and notes. Examples: "Work", "Home", "Kids School", "Arlo Development".

**Section**
A grouping of projects in the sidebar. Examples: "Work", "Personal", "Archive". Organizational only.

**Ingestion**
The process of Arlo absorbing content from external sources (email, Granola transcripts, documents) and extracting tasks, notes, or context.

**created_by**
Field on every task/note indicating who created it: `"user"` or `"arlo"`. Lets you see what Arlo generated vs. what you entered.

**source**
Optional field indicating where an item came from. Examples: `"email"`, `"granola"`, `"manual"`. Useful for tracing why a task exists.

**Proactive Layer**
The system of scheduled jobs and triggers that make Arlo do things without being asked: morning briefings, reminder delivery, stale project nudges, content watching.

**MEMORY.md**
Markdown files written by Arlo for Claude Code to read. Not the source of truth—a projection of relevant context into the filesystem for coding sessions.

---

## Reference Implementation

The original Task Vault Electron app has working UI, themes, animations, and components. Use it as reference—port the UI, ignore the file system logic.

**Location**: `/Users/christopherhayes/Projects/task-vault`

Key paths:

```
src/renderer/components/   # React components (TaskRow, Sidebar, TaskDetail, etc.)
src/renderer/styles/       # Tailwind config, global CSS
src/renderer/contexts/     # State management patterns
src/renderer/hooks/        # Custom hooks
src/shared/types.ts        # Type definitions (data model reference)
tailwind.config.js         # Design tokens, colors, spacing
```

What to port:

- Task row layout and interactions
- Sidebar with sections, projects, smart views
- Detail panel with due date picker, reminders, repeat config
- Context menus
- Drag and drop (dnd-kit)
- Dark/light theming
- Animations (framer-motion)

What to ignore:

- All file system operations (`src/main/`)
- Electron IPC
- Local file watching
- Frontmatter parsing
