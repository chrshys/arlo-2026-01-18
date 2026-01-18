# Draggable Notes with Mixed Task/Note Ordering

**Date:** 2026-01-17
**Status:** Approved

## Overview

Make notes draggable and sortable within sections and across projects, matching task drag-and-drop behavior. Notes and tasks share a unified sort order, allowing them to be freely intermixed in any order within a section.

## Requirements

- Notes become draggable with grip handles (like tasks)
- Mixed ordering: notes and tasks can be reordered together in a unified list
- Drop targets: sections and projects only (not smart lists - notes don't have due dates)
- Cross-project movement supported via drag-to-sidebar

## Data Model

### No Schema Changes

Notes already have the required fields:

- `sortOrder: v.optional(v.number())`
- `projectId: v.optional(v.id('projects'))`
- `sectionId: v.optional(v.id('sections'))`

### New/Updated Mutations in `convex/notes.ts`

**Add `reorderMixed` mutation** for mixed task/note reordering:

```typescript
export const reorderMixed = mutation({
  args: {
    sectionId: v.id('sections'),
    taskOrder: v.array(v.id('tasks')),
    noteOrder: v.array(v.id('notes')),
  },
  handler: async (ctx, { sectionId, taskOrder, noteOrder }) => {
    // Build combined order map
    // taskOrder and noteOrder contain IDs in their new positions
    // We need to assign sortOrder values that maintain interleaving
    // Example: if reordered list is [task1, note1, task2, note2]
    // taskOrder = [task1, task2], noteOrder = [note1, note2]
    // But we need to know the interleaved positions...
  },
})
```

Actually, simpler approach - pass the full interleaved order:

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

**Update `moveToProject` mutation** to accept optional `sortOrder`:

```typescript
export const moveToProject = mutation({
  args: {
    noteId: v.id('notes'),
    projectId: v.union(v.id('projects'), v.null()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { noteId, projectId, sortOrder }) => {
    const updates: Partial<Doc<'notes'>> = {
      projectId: projectId ?? undefined,
      sectionId: undefined, // Clear section on project move
      updatedAt: Date.now(),
    }
    if (sortOrder !== undefined) {
      updates.sortOrder = sortOrder
    }
    await ctx.db.patch(noteId, updates)
  },
})
```

**Add `moveToSection` mutation**:

```typescript
export const moveToSection = mutation({
  args: {
    noteId: v.id('notes'),
    sectionId: v.id('sections'),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { noteId, sectionId, sortOrder }) => {
    const section = await ctx.db.get(sectionId)
    if (!section) throw new Error('Section not found')

    await ctx.db.patch(noteId, {
      sectionId,
      projectId: section.projectId,
      sortOrder: sortOrder ?? Date.now(),
      updatedAt: Date.now(),
    })
  },
})
```

## Component Changes

### 1. Update `lib/drag-utils.ts`

Add `'note'` to the `DragItemType` union:

```typescript
export type DragItemType = 'task' | 'project' | 'folder' | 'note'
```

### 2. Create `DraggableNoteRow` Component

New file: `components/notes/DraggableNoteRow.tsx`

Mirrors `DraggableTaskRow` pattern:

```typescript
export function DraggableNoteRow({ noteId, ...props }) {
  const { activeId } = useUnifiedDrag()
  const isActive = activeId === createDragId('note', noteId)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: createDragId('note', noteId),
    animateLayoutChanges: () => false,
  })

  const shouldHide = isDragging || isActive
  const style = {
    transform: shouldHide ? undefined : CSS.Transform.toString(transform),
    transition: shouldHide ? undefined : transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-center gap-2">
        <button {...listeners} className="cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        {/* Existing NoteRow content */}
      </div>
    </div>
  )
}
```

### 3. Update `SectionGroup.tsx`

**Merge tasks and notes into unified sorted list:**

```typescript
// Build combined items array
const items = useMemo(() => {
  const combined = [
    ...pendingTasks.map((t) => ({
      type: 'task' as const,
      id: t._id,
      sortOrder: t.sortOrder ?? 0,
      data: t,
    })),
    ...sortedNotes.map((n) => ({
      type: 'note' as const,
      id: n._id,
      sortOrder: n.sortOrder ?? 0,
      data: n,
    })),
  ]
  return combined.sort((a, b) => a.sortOrder - b.sortOrder)
}, [pendingTasks, sortedNotes])
```

**Single SortableContext for mixed items:**

```typescript
<SortableContext items={items.map(i => createDragId(i.type, i.id))}>
  {items.map(item =>
    item.type === 'task'
      ? <DraggableTaskRow key={item.id} task={item.data} ... />
      : <DraggableNoteRow key={item.id} noteId={item.id} ... />
  )}
</SortableContext>
```

**Update `useDndMonitor` for mixed reordering:**

```typescript
useDndMonitor({
  onDragEnd: (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const { type: activeType } = parseDragId(String(active.id))
    const { type: overType } = parseDragId(String(over.id))

    // Only handle local task/note reordering
    const isLocalReorder =
      (activeType === 'task' || activeType === 'note') &&
      (overType === 'task' || overType === 'note')

    if (!isLocalReorder) return

    const oldIndex = items.findIndex((i) => createDragId(i.type, i.id) === active.id)
    const newIndex = items.findIndex((i) => createDragId(i.type, i.id) === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)

    // Call mutation with new order
    reorderMixed({
      items: reordered.map((i) => ({ type: i.type, id: i.id })),
    })
  },
})
```

### 4. Update `TasksView.tsx`

**Add note collision detection:**

```typescript
// In customCollisionDetection function
if (activeType === 'note') {
  // Notes can drop on sections and projects only (not smart lists)
  const sectionCollisions = collisions.filter(
    (c) => String(c.id).startsWith('section::') || String(c.id).startsWith('droppable-section::')
  )
  if (sectionCollisions.length > 0) return sectionCollisions

  const projectCollisions = collisions.filter((c) => String(c.id).startsWith('project::'))
  if (projectCollisions.length > 0) return projectCollisions

  // Fall back to item reordering
  return rectIntersection(args)
}
```

**Add note drop handling in `handleDragEnd`:**

```typescript
if (activeType === 'note') {
  const noteId = activeItemId as Id<'notes'>

  if (isDragType(overId, 'section') || isDragType(overId, 'droppable-section')) {
    const sectionId = parseDragId(overId).id as Id<'sections'>
    await moveNoteToSection({ noteId, sectionId })
  } else if (isDragType(overId, 'project')) {
    const projectId = parseDragId(overId).id as Id<'projects'>
    await moveNoteToProject({ noteId, projectId })
  }
  // Local reordering handled by SectionGroup's useDndMonitor

  return
}
```

**Add note to DragOverlay:**

```typescript
<DragOverlay>
  {activeId && activeType === 'task' && (
    <TaskRowOverlay taskId={activeItemId} />
  )}
  {activeId && activeType === 'note' && (
    <NoteRowOverlay noteId={activeItemId} />
  )}
  {/* ... existing project/folder overlays */}
</DragOverlay>
```

## Files to Change

| File                                    | Changes                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `lib/drag-utils.ts`                     | Add `'note'` to `DragItemType` union                               |
| `convex/notes.ts`                       | Add `reorderMixed`, `moveToSection`; update `moveToProject`        |
| `components/notes/DraggableNoteRow.tsx` | New file - draggable note row component                            |
| `components/notes/NoteRow.tsx`          | May refactor to share code with DraggableNoteRow                   |
| `components/tasks/SectionGroup.tsx`     | Merge tasks+notes, unified SortableContext, mixed reorder handling |
| `components/tasks/TasksView.tsx`        | Note collision detection, note drop routing, note drag overlay     |

## Edge Cases

1. **New items** - Assign `sortOrder = max(existing) + 1` to append at end (existing behavior)

2. **Empty sections** - No special handling needed

3. **Completed tasks** - Render separately below pending items. Notes don't have completion state, so they stay in the main mixed list. Mixed ordering only applies to pending tasks + notes.

4. **Cross-project drops** - Clear `sectionId` when moving note to a different project (goes to default/first section)

5. **Drag overlay** - Show note preview (title + icon) when dragging

## Testing

- Drag note within section to reorder among tasks
- Drag note to different section in same project
- Drag note to different project via sidebar
- Drag task to position between notes
- Verify completed tasks stay separate from mixed list
- Verify new notes/tasks appear at correct position
