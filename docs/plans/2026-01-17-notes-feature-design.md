# Notes Feature Design

> Captured from brainstorming session, 2026-01-17

## Overview

Add notes to Arlo alongside tasks. Notes have a title and rich text body using the Novel editor. They live in the same hierarchy as tasks (projects/sections) and can be created by users or Arlo.

## Data Model

New `notes` table in Convex schema:

```typescript
notes: defineTable({
  title: v.string(),
  content: v.string(),              // Novel's JSON output (ProseMirror doc)
  projectId: v.optional(v.id('projects')),
  sectionId: v.optional(v.id('sections')),
  sortOrder: v.optional(v.number()),
  createdBy: v.union(v.literal('user'), v.literal('arlo')),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_project', ['projectId'])
  .index('by_updated', ['updatedAt']),
```

**Key decisions:**

- Separate table from tasks (keeps types clean, queries simple)
- Content stored as JSON string (ProseMirror document format)
- Same hierarchy as tasks via `projectId` and `sectionId`
- No status field (notes aren't completable)
- `updatedAt` for "recently edited" queries

## UI Integration

### List View

Notes appear inline with tasks, distinguished by icon:

```
Project: Work
├── Section: In Progress
│   ├── ☑ Task: Review PR #123
│   ├── 📄 Note: API Design Decisions
│   └── ☑ Task: Update docs
```

### Creating Notes

- "+" button dropdown: "New Task" / "New Note"
- Keyboard shortcut: `N` for new note
- Arlo can create via `createNote` tool

### Note Row

- 📄 icon instead of checkbox
- Title only (no status, due date, priority)
- Click opens in detail panel

### Detail Panel

- Title field at top (editable)
- Novel editor fills remaining space
- No due date, reminders, or subtasks sections

### Smart Lists

- **Inbox:** Shows notes without a project
- **Today / Next 7 Days:** Notes don't appear (no dates)

## Novel Integration

### Installation

```bash
pnpm add novel
```

### Component Usage

```tsx
import { Editor } from 'novel'

;<Editor
  defaultValue={note.content ? JSON.parse(note.content) : undefined}
  onUpdate={(editor) => {
    const json = editor.getJSON()
    debouncedSave(json)
  }}
  className="prose dark:prose-invert"
/>
```

### Features (Out of Box)

- Slash commands (`/heading`, `/list`, `/image`, etc.)
- Bubble menu on text selection (bold, italic, link)
- Drag handles on blocks
- Image uploads (wire to Convex file storage)
- Markdown shortcuts (`**bold**`, `# heading`)
- Dark mode via Tailwind prose classes

### Saving Strategy

- Debounced auto-save (500ms after typing stops)
- No explicit save button
- `updatedAt` updates on each save
- Optimistic UI

### Image Uploads

- Custom upload handler → Convex file storage
- Store file ID in document JSON
- Resolve URL on render

## Arlo Integration

### New Tools

| Tool         | Purpose                                       |
| ------------ | --------------------------------------------- |
| `createNote` | Create a note with title and optional content |
| `listNotes`  | List notes (optionally filtered by project)   |
| `updateNote` | Update title or content                       |

### Content Format

Arlo works in markdown (natural for LLMs):

- When Arlo creates/updates: markdown → ProseMirror JSON
- When Arlo reads: ProseMirror JSON → markdown

```typescript
createNote: {
  description: "Create a note in the user's workspace",
  parameters: {
    title: z.string(),
    content: z.string().optional(),  // markdown
    projectId: z.string().optional(),
  },
  execute: async ({ title, content, projectId }) => {
    const prosemirrorJson = markdownToProseMirror(content)
    // save to convex
  }
}
```

### Use Cases

- "Summarize our conversation" → Arlo creates a note
- "What did we decide about the API?" → Arlo searches notes
- "Add a section about error handling" → Arlo updates note

### Context

- When user opens a note, Arlo sees it
- Arlo can reference notes in responses

### Not Now

- AI auto-suggestions inside editor
- Inline Arlo commands in notes

## Cross-Platform Strategy

### Phase 1: Web (Now)

- Next.js app with Novel editor
- Works on all devices via browser
- PWA-capable with manifest

### Phase 2: Desktop (When Needed)

- Wrap with Electron or Tauri
- Novel works unchanged
- Enables: native menus, global shortcuts, menu bar

### Phase 3: Mobile Native (If Needed)

- React Native shell for native UI
- Novel in WebView for editing
- postMessage bridge for communication
- Only if PWA feels inadequate

### Architectural Principles

- Build for web first
- Keep Novel isolated (easy to wrap later)
- Store content as JSON (portable)

### Not Now

- Electron/Tauri packaging
- React Native
- Offline-first sync

## Implementation Sequence

1. Add `notes` table to schema
2. Create CRUD mutations/queries
3. Add Novel editor component
4. Build note detail panel
5. Integrate notes into list views
6. Wire up image uploads to Convex storage
7. Add Arlo tools (createNote, listNotes, updateNote)
8. Add markdown ↔ ProseMirror conversion for Arlo
