# Folder View Design

**Date:** 2026-01-17
**Status:** Approved

## Overview

When clicking a folder in the task view sidebar, show the folder's contents (all projects, sections, and tasks) in the main panel. The view is fully interactive with cross-project drag & drop support.

## User Experience

### Hierarchy Display

```
Folder View (main panel)
├── Project 1 (collapsible)
│   ├── Task (unsectioned)
│   ├── Task (unsectioned)
│   ├── Section A (collapsible)
│   │   ├── Task
│   │   └── Task
│   └── Section B
│       └── Task
└── Project 2 (collapsible)
    ├── Section
    │   └── Task
    └── + Add Section
```

### Interactions

- **Complete/edit tasks** - Same as project view
- **Drag tasks within section** - Reorder
- **Drag tasks between sections (same project)** - Move + reorder
- **Drag tasks between projects** - Change project + section + reorder
- **Add task** - Each section has "+ Add task" button (context-aware)
- **Collapse/expand projects** - Click project header to toggle
- **Collapse/expand sections** - Same as project view

### Sidebar Behavior

- **Click folder name** → Select folder, show folder view in main panel
- **Click chevron** → Toggle expand/collapse (existing behavior)
- **Click project inside folder** → Select project, show project view (existing behavior)

Folder can be both selected AND expanded simultaneously. Selected folder shows same highlight style as selected projects.

## Technical Design

### Selection Model

Extend `useTaskNavigation` to support folder selection:

```typescript
type Selection =
  | { type: 'smart-list'; id: 'inbox' | 'today' | 'next7days' }
  | { type: 'project'; id: Id<'projects'> }
  | { type: 'folder'; id: Id<'folders'> } // NEW
```

### Data Fetching

When folder is selected, fetch:

1. Projects in folder - `projects.listByFolder(folderId)`
2. Sections per project - `sections.listByProject(projectId)` for each
3. Tasks per project - `tasks.listByProject(projectId)` for each

Multiple queries are acceptable for MVP (folders typically have 2-5 projects).

### Component Structure

```
TaskListPanel
├── SmartListView (existing)
├── ProjectView (existing)
└── FolderView (NEW)
    ├── FolderHeader
    │   └── folder name, total task count
    └── CollapsibleProject (one per project)
        ├── ProjectHeader (name, collapse toggle, task count)
        ├── UnsectionedTasks (droppable zone)
        │   └── DraggableTaskRow (reuse)
        └── SectionGroup (reuse existing)
            └── DraggableTaskRow (reuse)
```

**New Components:**

- `FolderView` - Main container for folder view
- `CollapsibleProject` - Collapsible wrapper for a project within folder view
- `FolderHeader` - Simple header with folder name and stats

**Reused Components:**

- `SectionGroup` - Already handles sections with tasks/notes
- `DraggableTaskRow` - Already handles task rendering and drag

### Collapse State

Project collapse state stored in component state within `FolderView`. Default: all projects expanded.

Could extend `useTaskNavigation` if persistence needed, but local state is fine for MVP.

### Drag & Drop

**Drop Zone Data:**

Each droppable area communicates:

- `projectId` - target project
- `sectionId` - target section (or `null` for unsectioned)

**Handler Logic (in TasksView.tsx):**

```typescript
// On task drop in folder view
if (sourceProjectId !== targetProjectId) {
  // Cross-project move
  await updateTask({
    id: taskId,
    projectId: targetProjectId,
    sectionId: targetSectionId,
  })
}
// Then handle reorder within target section
```

**Unsectioned Drop Zone:**

Add droppable area under each project header for unsectioned tasks. Uses same pattern as section droppables but with `sectionId: null`.

### Backend

**No changes needed.** Existing mutations cover all operations:

- `tasks.update` - accepts `projectId` and `sectionId`
- `tasks.reorder` - handles sort order
- All queries already exist

## Files to Modify

| File                                       | Change                                 |
| ------------------------------------------ | -------------------------------------- |
| `hooks/use-task-navigation.ts`             | Add `folder` selection type            |
| `components/tasks/TaskListPanel.tsx`       | Add `FolderView` component             |
| `components/tasks/TasksView.tsx`           | Handle cross-project task drops        |
| `components/tasks/DroppableFolderItem.tsx` | Split click handlers (chevron vs name) |

## Files to Create

| File                                      | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `components/tasks/CollapsibleProject.tsx` | Collapsible project wrapper for folder view |

## Out of Scope

- Batch queries for sections/tasks (optimize later if needed)
- Persisting project collapse state across sessions
- Adding projects from within folder view (use sidebar)
- Folder-level task count in sidebar (already shows per-project counts)
