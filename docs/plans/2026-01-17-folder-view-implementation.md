# Folder View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show folder contents (all projects/sections/tasks) in main panel when clicking a folder.

**Architecture:** Extend selection model to support folders, add FolderView component that renders CollapsibleProject wrappers around existing SectionGroup components, update drag handlers to support cross-project moves.

**Tech Stack:** React, Convex, dnd-kit, TypeScript

---

## Task 1: Extend Selection Model

**Files:**

- Modify: `hooks/use-task-navigation.tsx`

**Step 1: Add folder selection type**

Update the `TaskNavSelection` type to include folder:

```typescript
export type TaskNavSelection =
  | { type: 'smart-list'; list: SmartListType }
  | { type: 'project'; projectId: Id<'projects'> }
  | { type: 'folder'; folderId: Id<'folders'> }
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add hooks/use-task-navigation.tsx
git commit -m "feat(tasks): add folder selection type to navigation"
```

---

## Task 2: Make Folders Selectable in Sidebar

**Files:**

- Modify: `components/tasks/DroppableFolderItem.tsx`

**Step 1: Add onSelect prop and split click handlers**

Update the component to accept an `onSelect` callback and split the click area:

```typescript
interface DroppableFolderItemProps {
  folderId: Id<'folders'>
  name: string
  color?: string
  projects: Project[]
  isDropTarget?: boolean
  isSelected?: boolean // NEW
  onSelect?: (folderId: Id<'folders'>) => void // NEW
  onReorderProjects: (orderedIds: Id<'projects'>[]) => Promise<void>
}
```

**Step 2: Update the click handlers**

Replace the single button with split areas:

- Chevron click → `toggleFolder(folderId)` (expand/collapse)
- Name/main area click → `onSelect?.(folderId)` (select folder)

```typescript
{/* Chevron - toggle expand/collapse */}
<button
  onClick={(e) => {
    e.stopPropagation()
    toggleFolder(folderId)
  }}
  className="shrink-0 p-0.5 hover:bg-accent rounded"
>
  <ChevronRight
    className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-90')}
  />
</button>

{/* Name - select folder */}
<button
  onClick={() => onSelect?.(folderId)}
  className="flex items-center gap-2 flex-1 min-w-0"
>
  <Folder className="h-3.5 w-3.5 shrink-0" style={color ? { color } : undefined} />
  <span className="flex-1 text-left truncate font-medium">{name}</span>
</button>
```

**Step 3: Add selected state styling**

Add visual indicator when folder is selected:

```typescript
className={cn(
  'group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm transition-colors',
  'hover:bg-accent/50',
  isDragging && 'opacity-50 bg-accent',
  isDropTarget && isOver && 'bg-primary/15',
  isSelected && 'bg-accent border-l-2 border-primary'  // NEW
)}
```

**Step 4: Verify types compile**

Run: `pnpm typecheck`
Expected: Type errors in parent components (SortableFolderTree) - expected, will fix next

**Step 5: Commit**

```bash
git add components/tasks/DroppableFolderItem.tsx
git commit -m "feat(tasks): add folder selection to DroppableFolderItem"
```

---

## Task 3: Wire Up Folder Selection in Sidebar

**Files:**

- Modify: `components/tasks/SortableFolderTree.tsx`

**Step 1: Pass selection props to DroppableFolderItem**

Read the file first to understand the structure, then add the props:

```typescript
const { selection, setSelection } = useTaskNavigation()

// In the render:
<DroppableFolderItem
  key={folder._id}
  folderId={folder._id}
  name={folder.name}
  color={folder.color}
  projects={folderProjects}
  isDropTarget={activeType === 'project'}
  isSelected={selection.type === 'folder' && selection.folderId === folder._id}
  onSelect={(folderId) => setSelection({ type: 'folder', folderId })}
  onReorderProjects={handleReorderProjects}
/>
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Test manually**

Run: `pnpm dev`

- Click folder name → should select (no visible change in main panel yet)
- Click chevron → should expand/collapse
- Selected folder should show highlight

**Step 4: Commit**

```bash
git add components/tasks/SortableFolderTree.tsx
git commit -m "feat(tasks): wire folder selection in sidebar"
```

---

## Task 4: Create CollapsibleProject Component

**Files:**

- Create: `components/tasks/CollapsibleProject.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { ChevronRight, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionGroup } from './SectionGroup'
import { Id } from '@/convex/_generated/dataModel'

interface Task {
  _id: Id<'tasks'>
  title: string
  status: 'pending' | 'completed'
  priority?: 'none' | 'low' | 'medium' | 'high' | null
  dueDate?: number | null
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface Note {
  _id: Id<'notes'>
  title: string
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface Section {
  _id: Id<'sections'>
  name: string
  sortOrder: number
}

interface CollapsibleProjectProps {
  projectId: Id<'projects'>
  projectName: string
  projectColor?: string
  tasks: Task[]
  notes: Note[]
  sections: Section[]
  defaultExpanded?: boolean
}

export function CollapsibleProject({
  projectId,
  projectName,
  projectColor,
  tasks,
  notes,
  sections,
  defaultExpanded = true,
}: CollapsibleProjectProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Tasks and notes without a section
  const unsectionedTasks = tasks.filter((t) => !t.sectionId)
  const unsectionedNotes = notes.filter((n) => !n.sectionId)

  // Sort sections
  const sortedSections = sections.slice().sort((a, b) => a.sortOrder - b.sortOrder)

  // Count pending tasks
  const pendingCount = tasks.filter((t) => t.status === 'pending').length

  return (
    <div className="mb-4">
      {/* Project Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold hover:bg-accent/50 rounded-md transition-colors"
      >
        <ChevronRight
          className={cn('h-4 w-4 shrink-0 transition-transform', isExpanded && 'rotate-90')}
        />
        <Hash
          className="h-4 w-4 shrink-0"
          style={projectColor ? { color: projectColor } : undefined}
        />
        <span className="flex-1 text-left truncate">{projectName}</span>
        {pendingCount > 0 && (
          <span className="text-xs text-muted-foreground">{pendingCount}</span>
        )}
      </button>

      {/* Project Contents */}
      {isExpanded && (
        <div className="ml-6">
          {/* Unsectioned tasks and notes */}
          {(unsectionedTasks.length > 0 || unsectionedNotes.length > 0 || sections.length === 0) && (
            <SectionGroup
              tasks={unsectionedTasks}
              notes={unsectionedNotes}
              projectId={projectId}
            />
          )}

          {/* Sectioned tasks and notes */}
          {sortedSections.map((section) => {
            const sectionTasks = tasks.filter((t) => t.sectionId === section._id)
            const sectionNotes = notes.filter((n) => n.sectionId === section._id)
            return (
              <SectionGroup
                key={section._id}
                sectionId={section._id}
                sectionName={section.name}
                tasks={sectionTasks}
                notes={sectionNotes}
                projectId={projectId}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add components/tasks/CollapsibleProject.tsx
git commit -m "feat(tasks): add CollapsibleProject component for folder view"
```

---

## Task 5: Add FolderView to TaskListPanel

**Files:**

- Modify: `components/tasks/TaskListPanel.tsx`

**Step 1: Add folder data fetching**

Add queries for folder data when a folder is selected:

```typescript
// Get folder info
const selectedFolder = useQuery(
  api.folders.get,
  selection.type === 'folder' ? { id: selection.folderId } : 'skip'
)

// Get projects in the folder
const folderProjects = useQuery(
  api.projects.listByFolder,
  selection.type === 'folder' ? { folderId: selection.folderId } : 'skip'
)
```

**Note:** We need to create `folders.get` query if it doesn't exist. Check first.

**Step 2: Add FolderView component**

Add a new `FolderView` function component in the file:

```typescript
interface FolderViewProps {
  folderId: Id<'folders'>
  folderName: string
  projects: Array<{
    _id: Id<'projects'>
    name: string
    color?: string
  }>
}

function FolderView({ folderId, folderName, projects }: FolderViewProps) {
  // Fetch tasks and sections for each project
  // We'll use individual queries per project for simplicity

  return (
    <div>
      <div className="px-3 py-2 border-b border-border mb-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Folder className="h-5 w-5" />
          {folderName}
        </h2>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <p>No projects in this folder</p>
        </div>
      ) : (
        <div>
          {projects.map((project) => (
            <FolderProjectWrapper
              key={project._id}
              projectId={project._id}
              projectName={project.name}
              projectColor={project.color}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Wrapper that fetches data for each project
function FolderProjectWrapper({
  projectId,
  projectName,
  projectColor,
}: {
  projectId: Id<'projects'>
  projectName: string
  projectColor?: string
}) {
  const tasks = useQuery(api.tasks.listByProject, { projectId })
  const notes = useQuery(api.notes.listByProject, { projectId })
  const sections = useQuery(api.sections.listByProject, { projectId })

  if (tasks === undefined || sections === undefined) {
    return null // Loading
  }

  return (
    <CollapsibleProject
      projectId={projectId}
      projectName={projectName}
      projectColor={projectColor}
      tasks={tasks}
      notes={notes ?? []}
      sections={sections}
    />
  )
}
```

**Step 3: Update the main render to include FolderView**

```typescript
return (
  <div className={cn('h-full flex flex-col', className)}>
    <TaskListHeader
      onAddSection={() => setIsAddingSection(true)}
      onAddTask={() => setIsAddingTask(true)}
    />

    <div className="flex-1 overflow-auto p-2">
      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          Loading...
        </div>
      ) : selection.type === 'folder' ? (
        // Folder view
        <FolderView
          folderId={selection.folderId}
          folderName={selectedFolder?.name ?? 'Folder'}
          projects={folderProjects ?? []}
        />
      ) : isSmartList ? (
        // Smart list view
        <SmartListView ... />
      ) : (
        // Project view
        <ProjectView ... />
      )}
    </div>
  </div>
)
```

**Step 4: Add imports**

```typescript
import { CollapsibleProject } from './CollapsibleProject'
import { Folder } from 'lucide-react'
```

**Step 5: Verify types compile**

Run: `pnpm typecheck`
Expected: May need to add `folders.get` query

**Step 6: Commit**

```bash
git add components/tasks/TaskListPanel.tsx
git commit -m "feat(tasks): add FolderView to TaskListPanel"
```

---

## Task 6: Add folders.get Query (if needed)

**Files:**

- Modify: `convex/folders.ts`

**Step 1: Check if get query exists**

Read `convex/folders.ts` and check for a `get` query.

**Step 2: Add get query if missing**

```typescript
export const get = query({
  args: { id: v.id('folders') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})
```

**Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/folders.ts
git commit -m "feat(convex): add folders.get query"
```

---

## Task 7: Update TaskListHeader for Folder Context

**Files:**

- Modify: `components/tasks/TaskListHeader.tsx`

**Step 1: Read the file and understand current behavior**

Check how the header currently determines what to show.

**Step 2: Update to handle folder selection**

The header should show:

- Folder name when folder is selected
- Hide "Add Section" button for folder view (sections belong to projects)

**Step 3: Commit**

```bash
git add components/tasks/TaskListHeader.tsx
git commit -m "feat(tasks): update TaskListHeader for folder context"
```

---

## Task 8: Handle Cross-Project Task Drops

**Files:**

- Modify: `components/tasks/TasksView.tsx`

**Step 1: Update collision detection for folder view**

When in folder view and dragging tasks, we need to detect drops on:

- Different sections (same or different project)
- Project headers (unsectioned area)

Add section drop targets to collision detection:

```typescript
// Check for section drops in folder view
const sectionCollision = pointerCollisions.find((c) => {
  const id = c.id as string
  return id.startsWith('section::') || id.startsWith('unsectioned::')
})
if (sectionCollision) {
  return [sectionCollision]
}
```

**Step 2: Update handleDragEnd for cross-project moves**

```typescript
// Handle section drops (for folder view cross-project moves)
if (overIdStr.startsWith('section::')) {
  const [, projectId, sectionId] = overIdStr.split('::')
  await moveTaskToProject({
    id: taskId,
    projectId: projectId as Id<'projects'>,
    sectionId: sectionId as Id<'sections'>,
  })
  return
}

if (overIdStr.startsWith('unsectioned::')) {
  const [, projectId] = overIdStr.split('::')
  await moveTaskToProject({
    id: taskId,
    projectId: projectId as Id<'projects'>,
    sectionId: undefined,
  })
  return
}
```

**Step 3: Commit**

```bash
git add components/tasks/TasksView.tsx
git commit -m "feat(tasks): handle cross-project task drops in folder view"
```

---

## Task 9: Add Droppable Zones to SectionGroup

**Files:**

- Modify: `components/tasks/SectionGroup.tsx`

**Step 1: Make sections droppable for cross-project moves**

Add `useDroppable` to SectionGroup:

```typescript
import { useDroppable } from '@dnd-kit/core'

// Inside component:
const droppableId = sectionId ? `section::${projectId}::${sectionId}` : `unsectioned::${projectId}`

const { setNodeRef: setDropRef, isOver } = useDroppable({
  id: droppableId,
})
```

**Step 2: Apply drop ref and visual feedback**

```typescript
<div
  ref={setDropRef}
  className={cn('mb-4', isOver && 'bg-primary/10 rounded-md')}
>
  {/* existing content */}
</div>
```

**Step 3: Commit**

```bash
git add components/tasks/SectionGroup.tsx
git commit -m "feat(tasks): add droppable zones to SectionGroup for folder view"
```

---

## Task 10: Final Testing and Polish

**Step 1: Run full type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 2: Run linter**

Run: `pnpm lint`
Expected: PASS (or fix any issues)

**Step 3: Manual testing checklist**

- [ ] Click folder in sidebar → main panel shows folder contents
- [ ] Click chevron → expands/collapses folder in sidebar (doesn't change selection)
- [ ] Projects in folder view are collapsible
- [ ] Tasks can be completed/edited in folder view
- [ ] Drag task within same section → reorders
- [ ] Drag task to different section (same project) → moves
- [ ] Drag task to different project → moves to that project
- [ ] "+ Add task" in each section works correctly
- [ ] Notes display in folder view
- [ ] Completed tasks section works per-section

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(tasks): complete folder view implementation"
```

---

## Summary

| Task | Description                              |
| ---- | ---------------------------------------- |
| 1    | Extend selection model with folder type  |
| 2    | Make folders selectable in sidebar       |
| 3    | Wire up folder selection                 |
| 4    | Create CollapsibleProject component      |
| 5    | Add FolderView to TaskListPanel          |
| 6    | Add folders.get query (if needed)        |
| 7    | Update TaskListHeader for folder context |
| 8    | Handle cross-project task drops          |
| 9    | Add droppable zones to SectionGroup      |
| 10   | Final testing and polish                 |
