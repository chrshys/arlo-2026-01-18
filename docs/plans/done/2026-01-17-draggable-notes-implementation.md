# Draggable Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make notes draggable and sortable with mixed task/note ordering within sections, and droppable across sections and projects.

**Architecture:** Extend existing @dnd-kit drag system to include notes. Notes and tasks share unified sortOrder for mixed ordering. DraggableNoteRow mirrors DraggableTaskRow pattern.

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, Convex mutations, React

---

## Task 1: Add 'note' to DragItemType

**Files:**

- Modify: `lib/drag-utils.ts:10,42-44`

**Step 1: Update DragItemType union**

In `lib/drag-utils.ts`, change line 10 from:

```typescript
export type DragItemType = 'task' | 'project' | 'folder'
```

to:

```typescript
export type DragItemType = 'task' | 'project' | 'folder' | 'note'
```

**Step 2: Update isValidDragType function**

Change lines 42-44 from:

```typescript
function isValidDragType(type: string): type is DragItemType {
  return type === 'task' || type === 'project' || type === 'folder'
}
```

to:

```typescript
function isValidDragType(type: string): type is DragItemType {
  return type === 'task' || type === 'project' || type === 'folder' || type === 'note'
}
```

**Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/drag-utils.ts
git commit -m "feat(drag): add 'note' to DragItemType union"
```

---

## Task 2: Add Convex mutations for note reordering

**Files:**

- Modify: `convex/notes.ts`

**Step 1: Add reorderMixed mutation**

Add after line 130 (after `moveToProject`):

```typescript
export const reorderMixed = mutation({
  args: {
    items: v.array(
      v.object({
        type: v.union(v.literal('task'), v.literal('note')),
        id: v.string(),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    for (let i = 0; i < items.length; i++) {
      const { type, id } = items[i]
      if (type === 'task') {
        await ctx.db.patch(id as Id<'tasks'>, { sortOrder: i })
      } else {
        await ctx.db.patch(id as Id<'notes'>, { sortOrder: i })
      }
    }
  },
})
```

**Step 2: Add moveToSection mutation**

Add after `reorderMixed`:

```typescript
export const moveToSection = mutation({
  args: {
    noteId: v.id('notes'),
    projectId: v.id('projects'),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { noteId, projectId, sectionId }) => {
    // Get existing items in target to calculate sortOrder
    const existingTasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
    const existingNotes = await ctx.db
      .query('notes')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()

    const relevantTasks = sectionId
      ? existingTasks.filter((t) => t.sectionId === sectionId)
      : existingTasks.filter((t) => t.sectionId === undefined)
    const relevantNotes = sectionId
      ? existingNotes.filter((n) => n.sectionId === sectionId)
      : existingNotes.filter((n) => n.sectionId === undefined)

    const maxSortOrder = Math.max(
      ...relevantTasks.map((t) => t.sortOrder ?? 0),
      ...relevantNotes.map((n) => n.sortOrder ?? 0),
      -1
    )

    await ctx.db.patch(noteId, {
      projectId,
      sectionId,
      sortOrder: maxSortOrder + 1,
      updatedAt: Date.now(),
    })
  },
})
```

**Step 3: Add import for Id type at top of file**

The file already imports from `./_generated/server`, but we need `Id` type. Add to imports:

```typescript
import { Id } from './_generated/dataModel'
```

**Step 4: Verify Convex compiles**

Run: `pnpm typecheck`
Expected: No errors (Convex will hot-reload if dev server running)

**Step 5: Commit**

```bash
git add convex/notes.ts
git commit -m "feat(convex): add reorderMixed and moveToSection mutations for notes"
```

---

## Task 3: Create DraggableNoteRow component

**Files:**

- Create: `components/notes/DraggableNoteRow.tsx`

**Step 1: Create the component file**

Create `components/notes/DraggableNoteRow.tsx`:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileText, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Id } from '@/convex/_generated/dataModel'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useUnifiedDrag } from '@/components/tasks/TasksView'
import { createDragId } from '@/lib/drag-utils'

interface DraggableNoteRowProps {
  noteId: Id<'notes'>
  title: string
  isSelected: boolean
  onSelect: (noteId: Id<'notes'>) => void
}

export function DraggableNoteRow({ noteId, title, isSelected, onSelect }: DraggableNoteRowProps) {
  const { editingNoteId, setEditingNoteId, setSelectedNoteId, setShouldFocusNoteEditor } =
    useTaskNavigation()
  const { activeId } = useUnifiedDrag()
  const isEditing = editingNoteId === noteId
  const [editedTitle, setEditedTitle] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateNote = useMutation(api.notes.update)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } =
    useSortable({
      id: createDragId('note', noteId),
      animateLayoutChanges: () => false,
    })

  const isActive = activeId === noteId
  const shouldHide = isDragging || isActive

  const style = {
    transform: shouldHide ? undefined : CSS.Transform.toString(transform),
    transition: shouldHide || isSorting ? undefined : transition,
  }

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  // Sync editedTitle when title prop changes (and not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditedTitle(title)
    }
  }, [title, isEditing])

  const handleSave = async (focusEditor = false) => {
    const trimmedTitle = editedTitle.trim() || 'Untitled'
    if (trimmedTitle !== title) {
      await updateNote({ id: noteId, title: trimmedTitle })
    }
    setEditingNoteId(null)
    setSelectedNoteId(noteId)
    if (focusEditor) {
      setShouldFocusNoteEditor(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave(true)
    } else if (e.key === 'Escape') {
      setEditedTitle(title)
      setEditingNoteId(null)
    }
  }

  const handleClick = () => {
    onSelect(noteId)
  }

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left',
          'bg-accent text-accent-foreground',
          shouldHide && 'opacity-0'
        )}
      >
        <div className="shrink-0 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </div>
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={() => handleSave(false)}
          onKeyDown={handleKeyDown}
          placeholder="Note title"
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left cursor-pointer',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground',
        shouldHide && 'opacity-0'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{title || 'Untitled'}</span>
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add components/notes/DraggableNoteRow.tsx
git commit -m "feat(notes): create DraggableNoteRow component with drag support"
```

---

## Task 4: Update SectionGroup for mixed ordering

**Files:**

- Modify: `components/tasks/SectionGroup.tsx`

**Step 1: Add imports**

At line 10, change:

```typescript
import { NoteRow } from '@/components/notes/NoteRow'
```

to:

```typescript
import { DraggableNoteRow } from '@/components/notes/DraggableNoteRow'
```

Add to existing imports from `@dnd-kit/sortable`:

```typescript
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
```

**Step 2: Add reorderMixed mutation**

After line 67 (`const reorderTasks = useMutation(api.tasks.reorder)`), add:

```typescript
const reorderMixed = useMutation(api.notes.reorderMixed)
```

**Step 3: Add optimistic state for mixed ordering**

After line 63 (`const [optimisticTaskOrder, setOptimisticTaskOrder] = ...`), add:

```typescript
const [optimisticMixedOrder, setOptimisticMixedOrder] = useState<Array<{
  type: 'task' | 'note'
  id: string
}> | null>(null)
```

**Step 4: Create combined items array**

After line 109 (`const sortedNotes = ...`), add:

```typescript
// Combined and sorted items for mixed ordering
const combinedItems = useMemo(() => {
  if (optimisticMixedOrder) {
    return optimisticMixedOrder
  }
  const items: Array<{ type: 'task' | 'note'; id: string; sortOrder: number }> = [
    ...pendingTasks.map((t) => ({ type: 'task' as const, id: t._id, sortOrder: t.sortOrder ?? 0 })),
    ...sortedNotes.map((n) => ({ type: 'note' as const, id: n._id, sortOrder: n.sortOrder ?? 0 })),
  ]
  return items.sort((a, b) => a.sortOrder - b.sortOrder)
}, [pendingTasks, sortedNotes, optimisticMixedOrder])
```

**Step 5: Update useDndMonitor for mixed reordering**

Replace lines 136-160 (the `useDndMonitor` block) with:

```typescript
// Listen to drag events from parent DndContext for mixed task/note reordering
useDndMonitor({
  onDragEnd: async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const activeParsed = parseDragId(active.id as string)
    const overParsed = parseDragId(over.id as string)

    // Only handle task/note reordering within this section
    const isLocalReorder =
      (activeParsed?.type === 'task' || activeParsed?.type === 'note') &&
      (overParsed?.type === 'task' || overParsed?.type === 'note')

    if (!isLocalReorder) return

    const oldIndex = combinedItems.findIndex(
      (i) => createDragId(i.type, i.id) === (active.id as string)
    )
    const newIndex = combinedItems.findIndex(
      (i) => createDragId(i.type, i.id) === (over.id as string)
    )

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove([...combinedItems], oldIndex, newIndex)
    const newOrder = reordered.map((i) => ({ type: i.type, id: i.id }))

    setOptimisticMixedOrder(newOrder)
    await reorderMixed({ items: newOrder })
    setOptimisticMixedOrder(null)
  },
})
```

**Step 6: Update SortableContext and rendering**

Replace lines 272-298 (the SortableContext block and notes rendering) with:

```typescript
<SortableContext
  items={combinedItems.map((i) => createDragId(i.type, i.id))}
  strategy={verticalListSortingStrategy}
>
  {combinedItems.map((item) => {
    if (item.type === 'task') {
      const task = pendingTasks.find((t) => t._id === item.id)
      if (!task) return null
      return (
        <DraggableTaskRow
          key={task._id}
          taskId={task._id}
          title={task.title}
          status={task.status}
          priority={task.priority}
          dueDate={task.dueDate}
        />
      )
    } else {
      const note = sortedNotes.find((n) => n._id === item.id)
      if (!note) return null
      return (
        <DraggableNoteRow
          key={note._id}
          noteId={note._id}
          title={note.title}
          isSelected={selectedNoteId === note._id}
          onSelect={setSelectedNoteId}
        />
      )
    }
  })}
</SortableContext>
```

**Step 7: Remove the separate notes rendering block**

Delete lines 289-298 (the old notes map that's now integrated above).

**Step 8: Verify types compile**

Run: `pnpm typecheck`
Expected: No errors

**Step 9: Commit**

```bash
git add components/tasks/SectionGroup.tsx
git commit -m "feat(tasks): integrate mixed task/note ordering in SectionGroup"
```

---

## Task 5: Update TasksView collision detection for notes

**Files:**

- Modify: `components/tasks/TasksView.tsx`

**Step 1: Add note collision detection**

After line 147 (end of `if (activeType === 'task')` block), add:

```typescript
if (activeType === 'note') {
  // For notes, prioritize sections and projects only (not smart lists)
  if (pointerCollisions.length > 0) {
    // Check for section drops (for cross-project moves)
    const sectionCollision = pointerCollisions.find((c) => {
      const id = c.id as string
      return id.startsWith('section::') || id.startsWith('unsectioned::')
    })
    if (sectionCollision) {
      return [sectionCollision]
    }

    // Then check for project drops
    const projectCollision = pointerCollisions.find((c) => {
      const parsed = parseDragId(c.id as string)
      return parsed?.type === 'project'
    })
    if (projectCollision) {
      return [projectCollision]
    }
  }
  // Fall back to rect intersection for note reordering
  return rectIntersection(args)
}
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add components/tasks/TasksView.tsx
git commit -m "feat(drag): add note collision detection in TasksView"
```

---

## Task 6: Update TasksView handleDragEnd for notes

**Files:**

- Modify: `components/tasks/TasksView.tsx`

**Step 1: Add moveNoteToSection mutation**

After line 89 (`const moveProjectToFolder = ...`), add:

```typescript
const moveNoteToSection = useMutation(api.notes.moveToSection)
const moveNoteToProject = useMutation(api.notes.moveToProject)
```

**Step 2: Add notes query for overlay**

After line 94 (`const tasks = useQuery(api.tasks.list)`), add:

```typescript
const notes = useQuery(api.notes.list)
```

**Step 3: Add note drop handling in handleDragEnd**

After line 268 (end of task drops handling, before `// Handle project drops`), add:

```typescript
// Handle note drops
if (activeParsed?.type === 'note') {
  const noteId = activeParsed.id as Id<'notes'>

  // Handle section drops (cross-project or cross-section moves)
  if (overIdStr.startsWith('section::')) {
    const [, projectId, sectionId] = overIdStr.split('::')
    await moveNoteToSection({
      noteId,
      projectId: projectId as Id<'projects'>,
      sectionId: sectionId as Id<'sections'>,
    })
    return
  }

  if (overIdStr.startsWith('unsectioned::')) {
    const [, projectId] = overIdStr.split('::')
    await moveNoteToSection({
      noteId,
      projectId: projectId as Id<'projects'>,
      sectionId: undefined,
    })
    return
  }

  // Dropping on a project in sidebar
  const overParsed = parseDragId(overIdStr)
  if (overParsed?.type === 'project') {
    await moveNoteToProject({
      id: noteId,
      projectId: overParsed.id as Id<'projects'>,
    })
    return
  }

  // Note reordering (dropping on another note or task) - handled by SectionGroup
  return
}
```

**Step 4: Verify types compile**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add components/tasks/TasksView.tsx
git commit -m "feat(drag): add note drop handling in TasksView handleDragEnd"
```

---

## Task 7: Add note drag overlay

**Files:**

- Modify: `components/tasks/TasksView.tsx`

**Step 1: Add FileText import**

Update the lucide-react import (line 27) to include `FileText`:

```typescript
import { Circle, Folder, Hash, FileText } from 'lucide-react'
```

**Step 2: Add activeNote lookup**

After line 300 (`const activeFolder = ...`), add:

```typescript
const activeNote = activeType === 'note' ? notes?.find((n) => n._id === activeId) : null
```

**Step 3: Add note overlay in DragOverlay**

After line 358 (the activeTask overlay block), add:

```typescript
{activeNote && (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-accent shadow-lg">
    <FileText className="h-4 w-4 text-muted-foreground" />
    <span className="truncate max-w-[200px]">{activeNote.title || 'Untitled'}</span>
  </div>
)}
```

**Step 4: Verify types compile**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add components/tasks/TasksView.tsx
git commit -m "feat(drag): add note drag overlay"
```

---

## Task 8: Manual testing

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test note dragging within section**

1. Navigate to a project with tasks and notes
2. Drag a note using the grip handle
3. Drop between tasks
4. Verify the note appears at the new position
5. Refresh the page and verify order persists

**Step 3: Test cross-section note movement**

1. Have a project with multiple sections
2. Drag a note from one section to another
3. Verify the note moves to the target section
4. Verify it appears at the end of the target section

**Step 4: Test cross-project note movement**

1. Drag a note onto a different project in the sidebar
2. Verify the note moves to that project
3. Verify it appears in the unsectioned area

**Step 5: Test task-note interleaving**

1. Drag a task below a note
2. Drag a note above a task
3. Verify mixed ordering works correctly
4. Refresh and verify order persists

**Step 6: Final commit**

If all tests pass:

```bash
git add -A
git commit -m "feat(notes): complete draggable notes implementation"
```

---

## Summary of files changed

| File                                    | Type   | Description                                      |
| --------------------------------------- | ------ | ------------------------------------------------ |
| `lib/drag-utils.ts`                     | Modify | Add 'note' to DragItemType                       |
| `convex/notes.ts`                       | Modify | Add reorderMixed, moveToSection mutations        |
| `components/notes/DraggableNoteRow.tsx` | Create | New draggable note row component                 |
| `components/tasks/SectionGroup.tsx`     | Modify | Mixed task/note SortableContext                  |
| `components/tasks/TasksView.tsx`        | Modify | Note collision detection, drop handling, overlay |
