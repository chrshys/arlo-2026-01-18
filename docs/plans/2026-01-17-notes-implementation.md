# Notes Feature Implementation Plan

> **For Claude:** Implement this plan task-by-task on the `feature/notes` branch.

**Goal:** Add notes alongside tasks with Novel rich text editor, same hierarchy, and Arlo integration.

**Architecture:** Notes are a parallel entity to tasks—same projectId/sectionId hierarchy, stored in separate table. Novel editor handles rich text, content stored as ProseMirror JSON. Arlo works with notes via markdown conversion.

**Tech Stack:** Convex (backend), Novel (editor), React (UI)

---

## Task 1: Add Notes Schema

**Files:** `convex/schema.ts`

Add the notes table after the `subtasks` table:

```typescript
notes: defineTable({
  title: v.string(),
  content: v.string(), // ProseMirror JSON
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

Verify: `npx convex dev --once`

Commit: `git commit -m "feat(schema): add notes table"`

---

## Task 2: Create Notes CRUD - Queries

**Files:** Create `convex/notes.ts`

```typescript
import { query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('notes').order('desc').collect()
  },
})

export const listByProject = query({
  args: { projectId: v.optional(v.id('projects')) },
  handler: async (ctx, { projectId }) => {
    if (projectId === undefined) {
      return await ctx.db
        .query('notes')
        .filter((q) => q.eq(q.field('projectId'), undefined))
        .collect()
    }
    return await ctx.db
      .query('notes')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
  },
})

export const get = query({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})
```

Verify: `npx convex dev --once`

Commit: `git commit -m "feat(notes): add list and get queries"`

---

## Task 3: Create Notes CRUD - Mutations

**Files:** Modify `convex/notes.ts`

Add mutations for create, update, delete, and move:

```typescript
import { query, mutation } from './_generated/server'

// Create note from UI
export const createFromUI = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, args) => {
    const existingNotes = args.projectId
      ? await ctx.db
          .query('notes')
          .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
          .collect()
      : await ctx.db
          .query('notes')
          .filter((q) => q.eq(q.field('projectId'), undefined))
          .collect()

    const relevantNotes = args.sectionId
      ? existingNotes.filter((n) => n.sectionId === args.sectionId)
      : existingNotes.filter((n) => n.sectionId === undefined)

    const maxSortOrder = relevantNotes.reduce((max, n) => Math.max(max, n.sortOrder ?? 0), -1)

    const now = Date.now()
    return await ctx.db.insert('notes', {
      title: args.title,
      content: args.content ?? '',
      projectId: args.projectId,
      sectionId: args.sectionId,
      sortOrder: maxSortOrder + 1,
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('notes'),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() })
    }
  },
})

export const updateContent = mutation({
  args: {
    id: v.id('notes'),
    content: v.string(),
  },
  handler: async (ctx, { id, content }) => {
    await ctx.db.patch(id, { content, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})

export const moveToProject = mutation({
  args: {
    id: v.id('notes'),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, { id, projectId }) => {
    const targetNotes = projectId
      ? await ctx.db
          .query('notes')
          .withIndex('by_project', (q) => q.eq('projectId', projectId))
          .collect()
      : await ctx.db
          .query('notes')
          .filter((q) => q.eq(q.field('projectId'), undefined))
          .collect()

    const unsectionedNotes = targetNotes.filter((n) => n.sectionId === undefined)
    const minSortOrder = unsectionedNotes.reduce((min, n) => Math.min(min, n.sortOrder ?? 0), 0)

    await ctx.db.patch(id, {
      projectId,
      sectionId: undefined,
      sortOrder: minSortOrder - 1,
      updatedAt: Date.now(),
    })
  },
})
```

Commit: `git commit -m "feat(notes): add CRUD mutations"`

---

## Task 4: Add Internal Mutations for Arlo

**Files:** Modify `convex/notes.ts`

```typescript
import { query, mutation, internalMutation, internalQuery } from './_generated/server'

// Internal mutation for Arlo to create notes
export const create = internalMutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  },
  handler: async (ctx, args) => {
    const existingNotes = args.projectId
      ? await ctx.db
          .query('notes')
          .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
          .collect()
      : await ctx.db
          .query('notes')
          .filter((q) => q.eq(q.field('projectId'), undefined))
          .collect()

    const maxSortOrder = existingNotes.reduce((max, n) => Math.max(max, n.sortOrder ?? 0), -1)

    const now = Date.now()
    return await ctx.db.insert('notes', {
      title: args.title,
      content: args.content ?? '',
      projectId: args.projectId,
      sectionId: undefined,
      sortOrder: maxSortOrder + 1,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const listAll = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query('notes').order('desc').collect()
  },
})

export const updateContentInternal = internalMutation({
  args: {
    id: v.id('notes'),
    content: v.string(),
  },
  handler: async (ctx, { id, content }) => {
    await ctx.db.patch(id, { content, updatedAt: Date.now() })
  },
})
```

Commit: `git commit -m "feat(notes): add internal mutations for Arlo"`

---

## Task 5: Install Novel Editor

Run: `pnpm add novel`

Commit: `git commit -m "chore: add novel editor dependency"`

---

## Task 6: Create Note Editor Component

**Files:** Create `components/notes/NoteEditor.tsx`

```typescript
'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Editor } from 'novel'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface NoteEditorProps {
  noteId: Id<'notes'>
  initialContent: string
}

export function NoteEditor({ noteId, initialContent }: NoteEditorProps) {
  const updateContent = useMutation(api.notes.updateContent)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedSave = useCallback(
    (content: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        updateContent({ id: noteId, content })
      }, 500)
    },
    [noteId, updateContent]
  )

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const defaultValue = initialContent ? JSON.parse(initialContent) : undefined

  return (
    <div className="min-h-[300px] w-full">
      <Editor
        defaultValue={defaultValue}
        onUpdate={(editor) => {
          const json = JSON.stringify(editor?.getJSON())
          debouncedSave(json)
        }}
        className="prose dark:prose-invert prose-sm max-w-none"
      />
    </div>
  )
}
```

Commit: `git commit -m "feat(ui): add NoteEditor component with auto-save"`

---

## Task 7: Create Note Row Component

**Files:** Create `components/notes/NoteRow.tsx`

```typescript
'use client'

import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Id } from '@/convex/_generated/dataModel'

interface NoteRowProps {
  noteId: Id<'notes'>
  title: string
  isSelected: boolean
  onSelect: (noteId: Id<'notes'>) => void
}

export function NoteRow({ noteId, title, isSelected, onSelect }: NoteRowProps) {
  return (
    <div
      onClick={() => onSelect(noteId)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground'
      )}
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{title || 'Untitled'}</span>
    </div>
  )
}
```

Commit: `git commit -m "feat(ui): add NoteRow component"`

---

## Task 8: Create Note Detail Panel

**Files:** Create `components/notes/NoteDetailPanel.tsx`

```typescript
'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, X } from 'lucide-react'
import { NoteEditor } from './NoteEditor'
import { useState, useEffect } from 'react'

interface NoteDetailPanelProps {
  noteId: Id<'notes'>
  onClose: () => void
}

export function NoteDetailPanel({ noteId, onClose }: NoteDetailPanelProps) {
  const note = useQuery(api.notes.get, { id: noteId })
  const updateNote = useMutation(api.notes.update)
  const deleteNote = useMutation(api.notes.remove)

  const [title, setTitle] = useState('')

  useEffect(() => {
    if (note) {
      setTitle(note.title)
    }
  }, [note])

  if (!note) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    updateNote({ id: noteId, title: newTitle })
  }

  const handleDelete = async () => {
    await deleteNote({ id: noteId })
    onClose()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="text-lg font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <NoteEditor noteId={noteId} initialContent={note.content} />
      </div>
    </div>
  )
}
```

Commit: `git commit -m "feat(ui): add NoteDetailPanel"`

---

## Task 9: Integrate Notes into Task List

**Files:** Modify `components/tasks/TaskListPanel.tsx`, `components/tasks/SectionGroup.tsx`

1. Query notes alongside tasks for the selected project
2. Render NoteRow components after TaskRow components
3. Handle note selection (may need shared navigation context)

This task requires reading the existing components first to understand integration points.

Commit: `git commit -m "feat(ui): integrate notes into task list view"`

---

## Task 10: Add Create Note Button

**Files:** Modify `components/tasks/TaskListHeader.tsx` or `components/tasks/QuickAddTask.tsx`

Add dropdown to "+" button with "New Task" / "New Note" options.

Commit: `git commit -m "feat(ui): add create note option"`

---

## Task 11: Add Arlo Note Tools

**Files:** Modify `convex/arlo/tools.ts`, `convex/arlo/agent.ts`

Add `createNote`, `listNotes`, `updateNote` tools following the existing task tools pattern.

Commit: `git commit -m "feat(arlo): add note tools"`

---

## Task 12: Final Testing and Cleanup

1. Run `pnpm check`
2. Run `pnpm test:run`
3. Manual test: create note, edit, list, Arlo interaction
4. Update HISTORY.md

Commit: `git commit -m "docs: update history with notes implementation"`

---

## Summary

| Task | Description                 | Files                                |
| ---- | --------------------------- | ------------------------------------ |
| 1    | Add notes schema            | convex/schema.ts                     |
| 2    | Notes queries               | convex/notes.ts                      |
| 3    | Notes mutations             | convex/notes.ts                      |
| 4    | Internal mutations for Arlo | convex/notes.ts                      |
| 5    | Install Novel               | package.json                         |
| 6    | NoteEditor component        | components/notes/NoteEditor.tsx      |
| 7    | NoteRow component           | components/notes/NoteRow.tsx         |
| 8    | NoteDetailPanel             | components/notes/NoteDetailPanel.tsx |
| 9    | Integrate into task list    | TaskListPanel.tsx, SectionGroup.tsx  |
| 10   | Create note button          | TaskListHeader.tsx                   |
| 11   | Arlo note tools             | convex/arlo/tools.ts                 |
| 12   | Testing and cleanup         | HISTORY.md                           |
