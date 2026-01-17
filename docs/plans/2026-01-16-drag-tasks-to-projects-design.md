# Design: Drag Tasks to Projects

## Overview

Enable dragging tasks from the middle column onto sidebar targets:

- **Project** → assigns task to that project (clears section)
- **Inbox** → removes task from its project (sets projectId to undefined)
- **Today** → sets due date to today

Visual: full drag overlay with highlighted drop targets, consistent with existing project dragging.

## Architecture

### Unified Drag Context

**Current state:** Three separate `DndContext` instances:

- `SortableFolderTree` (sidebar project/folder reordering)
- `TaskListPanel` / `SectionGroup` (task reordering)

**Change:** Lift `DndContext` to `TasksView.tsx` so it wraps both the sidebar and middle panel. All draggable items share one context.

Each draggable item gets a typed ID:

```
task::abc123
project::def456
folder::ghi789
```

The `onDragEnd` handler inspects source/target types and routes to the appropriate action.

### Drop Targets in the Sidebar

**Smart list items (Inbox, Today):**

- Wrap with `useDroppable` hook
- Accept only `task::*` items
- Highlight on hover (e.g., blue ring or background change)

**Project items:**

- Already sortable for reordering—add `useDroppable` alongside `useSortable`
- Accept `task::*` items in addition to current project/folder sorting
- Same highlight treatment as smart lists

**Folders:**

- Not drop targets for tasks (tasks don't belong to folders directly)

**Collision detection:**

- Prioritize drop targets over sorting when dragging a task
- When dragging a task, projects act as drop zones (not sort targets)
- When dragging a project, use existing sort/folder-drop logic

### Drag Overlay & Visual Feedback

**Drag overlay:**

- When dragging a task, render a `DragOverlay` with a compact task preview (title + maybe status icon)
- Use `dropAnimation={null}` like existing project drags to prevent snap-back
- Hide the original task row during drag (`opacity-0`)

**Drop target highlighting:**

- Valid targets get a visual indicator when a task hovers over them
- Subtle background color change, left border accent, or ring
- Invalid targets (folders, other tasks) show no change

### Backend Mutations

**For dropping on a project or Inbox:**

- Add `moveToProject` mutation
- Set `projectId` to target project ID (or `undefined` for Inbox)
- Set `sectionId` to `undefined` (clear section)
- Update `sortOrder` to place task at the top of the target project's unsectioned area

**For dropping on Today:**

- Set `dueDate` to today's date
- Leave `projectId` and `sectionId` unchanged
- Task stays where it is, just gets a due date

## Files to Modify

| File                                        | Change                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `components/tasks/TasksView.tsx`            | Add unified `DndContext`, `DragOverlay`, and `onDragEnd` handler |
| `components/tasks/TasksSidebar.tsx`         | Make Inbox and Today items droppable                             |
| `components/tasks/SortableFolderTree.tsx`   | Remove its `DndContext`, receive drag state from parent          |
| `components/tasks/DraggableProjectItem.tsx` | Add `useDroppable` for task drops alongside existing sortable    |
| `components/tasks/TaskListPanel.tsx`        | Remove its `DndContext`, use shared context                      |
| `components/tasks/SectionGroup.tsx`         | Remove its `DndContext`, use shared context                      |
| `components/tasks/DraggableTaskRow.tsx`     | Prefix ID with `task::`, ensure works with unified context       |
| `convex/tasks.ts`                           | Add `moveToProject` mutation                                     |

**New helper:**

- `lib/drag-utils.ts` — Functions to parse typed IDs (`parseDropId("task::abc")` → `{ type: "task", id: "abc" }`)

## Decisions

- **Section handling:** Clear section when moving to a new project (user can re-assign manually)
- **Drop targets:** Projects, Inbox, Today only (not folders)
- **Visual style:** Full drag overlay, consistent with existing project drag behavior
