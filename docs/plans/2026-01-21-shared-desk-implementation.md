# Shared Desk Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a persistent shared workspace ("desk") where Arlo and the user collaborate on actionable items.

**Architecture:** The desk replaces the current TaskList in the canvas panel. It has four zones (Today, Needs Attention, Pinned, Working On) plus an Activity Log tab. Desk items are first-class entities in Convex, created by tools or user actions, and resolved through approvals/completions.

**Tech Stack:** Convex (schema, queries, mutations), React components, Tailwind CSS, existing DesktopPanelLayout

---

## Phase 0: Setup

### Task 0.1: Create Feature Branch

**Step 1: Create and checkout new branch**

```bash
git checkout -b feat/shared-desk
```

**Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `feat/shared-desk`

---

## Phase 1: Database Schema & Core CRUD

### Task 1.1: Add deskItems Table to Schema

**Files:**

- Modify: `convex/schema.ts`

**Step 1: Write the schema addition**

Add after the `activity` table definition:

```typescript
  deskItems: defineTable({
    userId: v.id('users'),

    // Item classification
    type: v.union(
      v.literal('approval'),
      v.literal('question'),
      v.literal('task'),
      v.literal('draft'),
      v.literal('progress')
    ),
    zone: v.union(
      v.literal('attention'),
      v.literal('pinned'),
      v.literal('working')
    ),

    // Content
    title: v.string(),
    description: v.optional(v.string()),

    // Type-specific data stored as JSON
    data: v.optional(v.any()),

    // Relationships
    sourceThreadId: v.optional(v.string()),
    linkedEntityId: v.optional(v.string()),
    linkedEntityType: v.optional(v.string()),

    // Metadata
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    priority: v.optional(v.number()),

    // Resolution
    status: v.union(
      v.literal('active'),
      v.literal('resolved'),
      v.literal('dismissed')
    ),
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_user_zone', ['userId', 'zone'])
    .index('by_user_status', ['userId', 'status']),
```

**Step 2: Run Convex to verify schema compiles**

Run: `npx convex dev --once`
Expected: Schema syncs successfully

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "$(cat <<'EOF'
feat(desk): add deskItems table to schema

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Create Desk Item Types

**Files:**

- Create: `convex/desk/types.ts`

**Step 1: Write type definitions**

```typescript
import { Id } from '../_generated/dataModel'

// Zone types - Today is computed, not stored
export type DeskZone = 'attention' | 'pinned' | 'working'

// Item types
export type DeskItemType = 'approval' | 'question' | 'task' | 'draft' | 'progress'

// Type-specific data shapes
export type ApprovalData = {
  actions: Array<{
    id: string
    label: string
    variant: 'primary' | 'secondary' | 'destructive'
  }>
  draftContent?: string
}

export type QuestionData = {
  question: string
  options: Array<{
    id: string
    label: string
  }>
}

export type TaskData = {
  taskId: Id<'tasks'>
}

export type DraftData = {
  draftType: 'email'
  to: string
  subject: string
  body: string
}

export type ProgressData = {
  operation: string
  percent?: number
  status: 'running' | 'completed' | 'failed'
}

export type DeskItemData = ApprovalData | QuestionData | TaskData | DraftData | ProgressData

// Full desk item shape (for UI)
export type DeskItem = {
  _id: Id<'deskItems'>
  _creationTime: number
  userId: Id<'users'>
  type: DeskItemType
  zone: DeskZone
  title: string
  description?: string
  data?: DeskItemData
  sourceThreadId?: string
  linkedEntityId?: string
  linkedEntityType?: string
  createdBy: 'user' | 'arlo'
  priority?: number
  status: 'active' | 'resolved' | 'dismissed'
  resolvedAt?: number
  resolution?: string
}
```

**Step 2: Commit**

```bash
git add convex/desk/types.ts
git commit -m "$(cat <<'EOF'
feat(desk): add desk item type definitions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: Create Desk Queries

**Files:**

- Create: `convex/desk/queries.ts`

**Step 1: Write the failing test**

Create `convex/desk/queries.test.ts`:

```typescript
import { convexTest } from 'convex-test'
import { expect, test, describe } from 'vitest'
import { api, internal } from '../_generated/api'
import schema from '../schema'

describe('desk queries', () => {
  test('listByZone returns items for specified zone', async () => {
    const t = convexTest(schema)

    // Create a test user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        clerkId: 'test_clerk_id',
        email: 'test@example.com',
      })
    })

    // Create desk items in different zones
    await t.run(async (ctx) => {
      await ctx.db.insert('deskItems', {
        userId,
        type: 'approval',
        zone: 'attention',
        title: 'Approve email',
        createdBy: 'arlo',
        status: 'active',
      })
      await ctx.db.insert('deskItems', {
        userId,
        type: 'task',
        zone: 'pinned',
        title: 'Pinned task',
        createdBy: 'user',
        status: 'active',
      })
    })

    // Mock authenticated user
    const asUser = t.withIdentity({ subject: 'test_clerk_id' })

    const attentionItems = await asUser.query(api.desk.queries.listByZone, {
      zone: 'attention',
    })

    expect(attentionItems).toHaveLength(1)
    expect(attentionItems[0].title).toBe('Approve email')
  })

  test('listActive returns all active items across zones', async () => {
    const t = convexTest(schema)

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        clerkId: 'test_clerk_id',
        email: 'test@example.com',
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('deskItems', {
        userId,
        type: 'approval',
        zone: 'attention',
        title: 'Active item',
        createdBy: 'arlo',
        status: 'active',
      })
      await ctx.db.insert('deskItems', {
        userId,
        type: 'task',
        zone: 'pinned',
        title: 'Resolved item',
        createdBy: 'user',
        status: 'resolved',
        resolvedAt: Date.now(),
      })
    })

    const asUser = t.withIdentity({ subject: 'test_clerk_id' })

    const activeItems = await asUser.query(api.desk.queries.listActive, {})

    expect(activeItems).toHaveLength(1)
    expect(activeItems[0].title).toBe('Active item')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test convex/desk/queries.test.ts`
Expected: FAIL - module not found

**Step 3: Write the queries**

Create `convex/desk/queries.ts`:

```typescript
import { query } from '../_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from '../users'

export const listByZone = query({
  args: {
    zone: v.union(v.literal('attention'), v.literal('pinned'), v.literal('working')),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    return await ctx.db
      .query('deskItems')
      .withIndex('by_user_zone', (q) => q.eq('userId', user._id).eq('zone', args.zone))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .order('desc')
      .collect()
  },
})

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)

    return await ctx.db
      .query('deskItems')
      .withIndex('by_user_status', (q) => q.eq('userId', user._id).eq('status', 'active'))
      .order('desc')
      .collect()
  },
})

export const get = query({
  args: { id: v.id('deskItems') },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      return null
    }

    return item
  },
})
```

**Step 4: Run test to verify it passes**

Run: `pnpm test convex/desk/queries.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/desk/queries.ts convex/desk/queries.test.ts
git commit -m "$(cat <<'EOF'
feat(desk): add desk item queries with tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: Create Desk Mutations

**Files:**

- Create: `convex/desk/mutations.ts`
- Create: `convex/desk/mutations.test.ts`

**Step 1: Write the failing test**

Create `convex/desk/mutations.test.ts`:

```typescript
import { convexTest } from 'convex-test'
import { expect, test, describe } from 'vitest'
import { api } from '../_generated/api'
import schema from '../schema'

describe('desk mutations', () => {
  test('create adds a new desk item', async () => {
    const t = convexTest(schema)

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        clerkId: 'test_clerk_id',
        email: 'test@example.com',
      })
    })

    const asUser = t.withIdentity({ subject: 'test_clerk_id' })

    const itemId = await asUser.mutation(api.desk.mutations.create, {
      type: 'task',
      zone: 'pinned',
      title: 'Important task',
      createdBy: 'user',
    })

    const item = await t.run(async (ctx) => {
      return await ctx.db.get(itemId)
    })

    expect(item).not.toBeNull()
    expect(item?.title).toBe('Important task')
    expect(item?.status).toBe('active')
  })

  test('resolve marks item as resolved', async () => {
    const t = convexTest(schema)

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        clerkId: 'test_clerk_id',
        email: 'test@example.com',
      })
    })

    const itemId = await t.run(async (ctx) => {
      return await ctx.db.insert('deskItems', {
        userId,
        type: 'approval',
        zone: 'attention',
        title: 'Pending approval',
        createdBy: 'arlo',
        status: 'active',
      })
    })

    const asUser = t.withIdentity({ subject: 'test_clerk_id' })

    await asUser.mutation(api.desk.mutations.resolve, {
      id: itemId,
      resolution: 'approved',
    })

    const item = await t.run(async (ctx) => {
      return await ctx.db.get(itemId)
    })

    expect(item?.status).toBe('resolved')
    expect(item?.resolution).toBe('approved')
    expect(item?.resolvedAt).toBeDefined()
  })

  test('dismiss marks item as dismissed', async () => {
    const t = convexTest(schema)

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        clerkId: 'test_clerk_id',
        email: 'test@example.com',
      })
    })

    const itemId = await t.run(async (ctx) => {
      return await ctx.db.insert('deskItems', {
        userId,
        type: 'question',
        zone: 'attention',
        title: 'Question',
        createdBy: 'arlo',
        status: 'active',
      })
    })

    const asUser = t.withIdentity({ subject: 'test_clerk_id' })

    await asUser.mutation(api.desk.mutations.dismiss, { id: itemId })

    const item = await t.run(async (ctx) => {
      return await ctx.db.get(itemId)
    })

    expect(item?.status).toBe('dismissed')
  })

  test('pin moves item to pinned zone', async () => {
    const t = convexTest(schema)

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        clerkId: 'test_clerk_id',
        email: 'test@example.com',
      })
    })

    const itemId = await t.run(async (ctx) => {
      return await ctx.db.insert('deskItems', {
        userId,
        type: 'task',
        zone: 'attention',
        title: 'Task to pin',
        createdBy: 'arlo',
        status: 'active',
      })
    })

    const asUser = t.withIdentity({ subject: 'test_clerk_id' })

    await asUser.mutation(api.desk.mutations.pin, { id: itemId })

    const item = await t.run(async (ctx) => {
      return await ctx.db.get(itemId)
    })

    expect(item?.zone).toBe('pinned')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test convex/desk/mutations.test.ts`
Expected: FAIL - module not found

**Step 3: Write the mutations**

Create `convex/desk/mutations.ts`:

```typescript
import { mutation, internalMutation } from '../_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from '../users'
import { Id } from '../_generated/dataModel'

export const create = mutation({
  args: {
    type: v.union(
      v.literal('approval'),
      v.literal('question'),
      v.literal('task'),
      v.literal('draft'),
      v.literal('progress')
    ),
    zone: v.union(v.literal('attention'), v.literal('pinned'), v.literal('working')),
    title: v.string(),
    description: v.optional(v.string()),
    data: v.optional(v.any()),
    sourceThreadId: v.optional(v.string()),
    linkedEntityId: v.optional(v.string()),
    linkedEntityType: v.optional(v.string()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    return await ctx.db.insert('deskItems', {
      userId: user._id,
      type: args.type,
      zone: args.zone,
      title: args.title,
      description: args.description,
      data: args.data,
      sourceThreadId: args.sourceThreadId,
      linkedEntityId: args.linkedEntityId,
      linkedEntityType: args.linkedEntityType,
      createdBy: args.createdBy,
      priority: args.priority,
      status: 'active',
    })
  },
})

// Internal version for Arlo to call from actions
export const createInternal = internalMutation({
  args: {
    userId: v.id('users'),
    type: v.union(
      v.literal('approval'),
      v.literal('question'),
      v.literal('task'),
      v.literal('draft'),
      v.literal('progress')
    ),
    zone: v.union(v.literal('attention'), v.literal('pinned'), v.literal('working')),
    title: v.string(),
    description: v.optional(v.string()),
    data: v.optional(v.any()),
    sourceThreadId: v.optional(v.string()),
    linkedEntityId: v.optional(v.string()),
    linkedEntityType: v.optional(v.string()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('deskItems', {
      userId: args.userId,
      type: args.type,
      zone: args.zone,
      title: args.title,
      description: args.description,
      data: args.data,
      sourceThreadId: args.sourceThreadId,
      linkedEntityId: args.linkedEntityId,
      linkedEntityType: args.linkedEntityType,
      createdBy: 'arlo',
      priority: args.priority,
      status: 'active',
    })
  },
})

export const resolve = mutation({
  args: {
    id: v.id('deskItems'),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    await ctx.db.patch(args.id, {
      status: 'resolved',
      resolution: args.resolution,
      resolvedAt: Date.now(),
    })
  },
})

export const dismiss = mutation({
  args: {
    id: v.id('deskItems'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    await ctx.db.patch(args.id, {
      status: 'dismissed',
      resolvedAt: Date.now(),
    })
  },
})

export const pin = mutation({
  args: {
    id: v.id('deskItems'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    await ctx.db.patch(args.id, {
      zone: 'pinned',
    })
  },
})

export const unpin = mutation({
  args: {
    id: v.id('deskItems'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    // When unpinning, move back to attention zone
    await ctx.db.patch(args.id, {
      zone: 'attention',
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('deskItems'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    data: v.optional(v.any()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const item = await ctx.db.get(args.id)

    if (!item || item.userId !== user._id) {
      throw new Error('Desk item not found')
    }

    const updates: Record<string, unknown> = {}
    if (args.title !== undefined) updates.title = args.title
    if (args.description !== undefined) updates.description = args.description
    if (args.data !== undefined) updates.data = args.data
    if (args.priority !== undefined) updates.priority = args.priority

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.id, updates)
    }
  },
})

// Internal version for updating progress
export const updateProgress = internalMutation({
  args: {
    id: v.id('deskItems'),
    percent: v.optional(v.number()),
    status: v.optional(v.union(v.literal('running'), v.literal('completed'), v.literal('failed'))),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id)
    if (!item) return

    const data = (item.data as { operation?: string; percent?: number; status?: string }) || {}
    const updates: Record<string, unknown> = {
      data: {
        ...data,
        percent: args.percent ?? data.percent,
        status: args.status ?? data.status,
      },
    }

    // If completed/failed, mark resolved
    if (args.status === 'completed' || args.status === 'failed') {
      updates.status = 'resolved'
      updates.resolvedAt = Date.now()
      updates.resolution = args.status
    }

    await ctx.db.patch(args.id, updates)
  },
})
```

**Step 4: Run test to verify it passes**

Run: `pnpm test convex/desk/mutations.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/desk/mutations.ts convex/desk/mutations.test.ts
git commit -m "$(cat <<'EOF'
feat(desk): add desk item mutations with tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Create Desk Index File

**Files:**

- Create: `convex/desk/index.ts`

**Step 1: Write the barrel export**

```typescript
// Re-export all desk functionality
export * from './queries'
export * from './mutations'
export type * from './types'
```

**Step 2: Verify Convex syncs**

Run: `npx convex dev --once`
Expected: Syncs successfully

**Step 3: Commit**

```bash
git add convex/desk/index.ts
git commit -m "$(cat <<'EOF'
feat(desk): add desk module barrel export

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Today Section (Computed View)

### Task 2.1: Create Today Data Query

The "Today" section is computed from tasks and calendar, not stored as a desk item.

**Files:**

- Create: `convex/desk/today.ts`
- Create: `convex/desk/today.test.ts`

**Step 1: Write the failing test**

Create `convex/desk/today.test.ts`:

```typescript
import { convexTest } from 'convex-test'
import { expect, test, describe } from 'vitest'
import { api } from '../_generated/api'
import schema from '../schema'

describe('today query', () => {
  test('returns tasks due today', async () => {
    const t = convexTest(schema)

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        clerkId: 'test_clerk_id',
        email: 'test@example.com',
        timezone: 'America/New_York',
      })
    })

    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const todayMs = today.getTime()

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 5)
    const overdueMs = yesterday.getTime()

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowMs = tomorrow.getTime()

    await t.run(async (ctx) => {
      // Due today
      await ctx.db.insert('tasks', {
        userId,
        title: 'Task due today',
        status: 'pending',
        dueDate: todayMs,
        createdBy: 'user',
      })
      // Overdue
      await ctx.db.insert('tasks', {
        userId,
        title: 'Overdue task',
        status: 'pending',
        dueDate: overdueMs,
        createdBy: 'user',
      })
      // Due tomorrow (should not appear)
      await ctx.db.insert('tasks', {
        userId,
        title: 'Future task',
        status: 'pending',
        dueDate: tomorrowMs,
        createdBy: 'user',
      })
      // Completed (should not appear)
      await ctx.db.insert('tasks', {
        userId,
        title: 'Completed task',
        status: 'completed',
        dueDate: todayMs,
        createdBy: 'user',
      })
    })

    const asUser = t.withIdentity({ subject: 'test_clerk_id' })

    const todayData = await asUser.query(api.desk.today.getToday, {})

    expect(todayData.tasksDueToday).toHaveLength(1)
    expect(todayData.tasksDueToday[0].title).toBe('Task due today')
    expect(todayData.overdueTasks).toHaveLength(1)
    expect(todayData.overdueTasks[0].title).toBe('Overdue task')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test convex/desk/today.test.ts`
Expected: FAIL - module not found

**Step 3: Write the today query**

Create `convex/desk/today.ts`:

```typescript
import { query } from '../_generated/server'
import { requireCurrentUser } from '../users'

// Helper to get start/end of day in user's timezone
function getDayBounds(timezone: string): { startOfDay: number; endOfDay: number } {
  const now = new Date()

  // Get the current date string in user's timezone
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone })

  // Create start of day in user's timezone
  const startOfDay = new Date(`${dateStr}T00:00:00`)
  const endOfDay = new Date(`${dateStr}T23:59:59.999`)

  // Adjust for timezone offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  })

  // For simplicity, we'll use UTC-based calculations
  // This works because we're comparing timestamps, not displaying times
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const offset = now.getTime() - userNow.getTime()

  return {
    startOfDay: startOfDay.getTime() + offset,
    endOfDay: endOfDay.getTime() + offset,
  }
}

export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const timezone = user.timezone || 'America/New_York'

    const { startOfDay, endOfDay } = getDayBounds(timezone)
    const now = Date.now()

    // Get all pending tasks for user
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .collect()

    // Separate into categories
    const tasksDueToday = allTasks.filter((task) => {
      if (!task.dueDate) return false
      return task.dueDate >= startOfDay && task.dueDate <= endOfDay
    })

    const overdueTasks = allTasks.filter((task) => {
      if (!task.dueDate) return false
      return task.dueDate < startOfDay
    })

    // Sort by due date
    tasksDueToday.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
    overdueTasks.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))

    return {
      date: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: timezone,
      }),
      tasksDueToday,
      overdueTasks,
      // Calendar events would be added here when we integrate
      meetings: [] as Array<{ time: string; title: string }>,
    }
  },
})
```

**Step 4: Run test to verify it passes**

Run: `pnpm test convex/desk/today.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/desk/today.ts convex/desk/today.test.ts
git commit -m "$(cat <<'EOF'
feat(desk): add today section computed query

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: UI Components

### Task 3.1: Create Base DeskCard Component

**Files:**

- Create: `components/desk/DeskCard.tsx`

**Step 1: Write the component**

```tsx
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DeskCardProps = {
  title: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  variant?: 'default' | 'attention' | 'progress'
  className?: string
}

export function DeskCard({
  title,
  description,
  icon,
  actions,
  children,
  variant = 'default',
  className,
}: DeskCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm',
        variant === 'attention' && 'border-l-4 border-l-red-500',
        variant === 'progress' && 'border-l-4 border-l-blue-500',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <div className="flex-shrink-0 text-muted-foreground">{icon}</div>}
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm leading-tight">{title}</h4>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
      {actions && <div className="mt-3 flex items-center gap-2 border-t pt-3">{actions}</div>}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/DeskCard.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add base DeskCard component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Create DeskZone Component

**Files:**

- Create: `components/desk/DeskZone.tsx`

**Step 1: Write the component**

```tsx
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DeskZoneProps = {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  emptyMessage?: string
  isEmpty?: boolean
}

export function DeskZone({
  title,
  icon,
  children,
  className,
  emptyMessage = 'Nothing here',
  isEmpty = false,
}: DeskZoneProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {isEmpty ? (
        <p className="text-xs text-muted-foreground/60 italic py-2">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/DeskZone.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add DeskZone container component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.3: Create TodaySection Component

**Files:**

- Create: `components/desk/TodaySection.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DeskZone } from './DeskZone'
import { DeskCard } from './DeskCard'
import { Sun, AlertCircle, CheckSquare, Calendar } from 'lucide-react'

export function TodaySection() {
  const today = useQuery(api.desk.today.getToday)

  if (!today) {
    return (
      <DeskZone title="TODAY" icon={<Sun className="h-4 w-4" />}>
        <div className="animate-pulse h-20 bg-muted rounded-lg" />
      </DeskZone>
    )
  }

  const hasContent =
    today.tasksDueToday.length > 0 || today.overdueTasks.length > 0 || today.meetings.length > 0

  return (
    <DeskZone
      title={`TODAY · ${today.date}`}
      icon={<Sun className="h-4 w-4" />}
      isEmpty={!hasContent}
      emptyMessage="Nothing scheduled for today"
    >
      {/* Meetings */}
      {today.meetings.length > 0 && (
        <DeskCard
          title={`${today.meetings.length} meeting${today.meetings.length > 1 ? 's' : ''}`}
          icon={<Calendar className="h-4 w-4" />}
        >
          <ul className="space-y-1 text-xs">
            {today.meetings.map((meeting, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">{meeting.time}</span>
                <span>{meeting.title}</span>
              </li>
            ))}
          </ul>
        </DeskCard>
      )}

      {/* Tasks due today */}
      {today.tasksDueToday.length > 0 && (
        <DeskCard
          title={`${today.tasksDueToday.length} task${today.tasksDueToday.length > 1 ? 's' : ''} due`}
          icon={<CheckSquare className="h-4 w-4" />}
        >
          <ul className="space-y-1 text-xs">
            {today.tasksDueToday.map((task) => (
              <li key={task._id} className="truncate">
                {task.title}
              </li>
            ))}
          </ul>
        </DeskCard>
      )}

      {/* Overdue tasks */}
      {today.overdueTasks.length > 0 && (
        <DeskCard
          title={`${today.overdueTasks.length} overdue`}
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          variant="attention"
        >
          <ul className="space-y-1 text-xs">
            {today.overdueTasks.map((task) => {
              const daysOverdue = task.dueDate
                ? Math.floor((Date.now() - task.dueDate) / (1000 * 60 * 60 * 24))
                : 0
              return (
                <li key={task._id} className="flex justify-between">
                  <span className="truncate">{task.title}</span>
                  <span className="text-red-500 text-xs">{daysOverdue}d overdue</span>
                </li>
              )
            })}
          </ul>
        </DeskCard>
      )}
    </DeskZone>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/TodaySection.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add TodaySection component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.4: Create ApprovalCard Component

**Files:**

- Create: `components/desk/ApprovalCard.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DeskCard } from './DeskCard'
import { Button } from '@/components/ui/button'
import { Mail, MessageSquare, Pin, X } from 'lucide-react'

type ApprovalCardProps = {
  id: Id<'deskItems'>
  title: string
  description?: string
  type: 'draft' | 'approval' | 'question'
  data?: {
    actions?: Array<{
      id: string
      label: string
      variant: 'primary' | 'secondary' | 'destructive'
    }>
    draftContent?: string
    question?: string
    options?: Array<{ id: string; label: string }>
    draftType?: string
    to?: string
    subject?: string
    body?: string
  }
}

export function ApprovalCard({ id, title, description, type, data }: ApprovalCardProps) {
  const resolve = useMutation(api.desk.mutations.resolve)
  const dismiss = useMutation(api.desk.mutations.dismiss)
  const pin = useMutation(api.desk.mutations.pin)

  const handleAction = async (actionId: string) => {
    await resolve({ id, resolution: actionId })
  }

  const handleDismiss = async () => {
    await dismiss({ id })
  }

  const handlePin = async () => {
    await pin({ id })
  }

  const icon =
    type === 'draft' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />

  // For drafts, show preview
  const draftPreview =
    type === 'draft' && data?.to ? (
      <div className="text-xs space-y-1 bg-muted/50 rounded p-2">
        <div>
          <span className="text-muted-foreground">To:</span> {data.to}
        </div>
        {data.subject && (
          <div>
            <span className="text-muted-foreground">Re:</span> {data.subject}
          </div>
        )}
        {data.body && <div className="mt-2 line-clamp-3 text-muted-foreground">{data.body}</div>}
      </div>
    ) : null

  // For questions, show options
  const questionOptions =
    type === 'question' && data?.options ? (
      <div className="flex flex-wrap gap-2">
        {data.options.map((option) => (
          <Button
            key={option.id}
            variant="outline"
            size="sm"
            onClick={() => handleAction(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    ) : null

  // Default actions for approvals/drafts
  const defaultActions =
    type !== 'question' ? (
      <>
        {data?.actions?.map((action) => (
          <Button
            key={action.id}
            variant={
              action.variant === 'primary'
                ? 'default'
                : action.variant === 'destructive'
                  ? 'destructive'
                  : 'outline'
            }
            size="sm"
            onClick={() => handleAction(action.id)}
          >
            {action.label}
          </Button>
        )) ?? (
          <>
            <Button size="sm" onClick={() => handleAction('approved')}>
              Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAction('edit')}>
              Edit
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={handlePin}>
          <Pin className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </>
    ) : (
      <Button variant="ghost" size="icon" onClick={handleDismiss}>
        <X className="h-4 w-4" />
      </Button>
    )

  return (
    <DeskCard
      title={title}
      description={description}
      icon={icon}
      variant="attention"
      actions={defaultActions}
    >
      {draftPreview}
      {questionOptions}
    </DeskCard>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/ApprovalCard.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add ApprovalCard component for attention zone

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.5: Create ProgressCard Component

**Files:**

- Create: `components/desk/ProgressCard.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { DeskCard } from './DeskCard'
import { Loader2 } from 'lucide-react'

type ProgressCardProps = {
  title: string
  description?: string
  percent?: number
  status: 'running' | 'completed' | 'failed'
}

export function ProgressCard({ title, description, percent, status }: ProgressCardProps) {
  return (
    <DeskCard
      title={title}
      description={description}
      icon={<Loader2 className="h-4 w-4 animate-spin" />}
      variant="progress"
    >
      {percent !== undefined && status === 'running' && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </DeskCard>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/ProgressCard.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add ProgressCard component for working zone

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.6: Create PinnedCard Component

**Files:**

- Create: `components/desk/PinnedCard.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DeskCard } from './DeskCard'
import { Button } from '@/components/ui/button'
import { Pin, ExternalLink, Check } from 'lucide-react'

type PinnedCardProps = {
  id: Id<'deskItems'>
  title: string
  description?: string
  linkedEntityType?: string
  linkedEntityId?: string
}

export function PinnedCard({ id, title, description, linkedEntityType }: PinnedCardProps) {
  const unpin = useMutation(api.desk.mutations.unpin)
  const resolve = useMutation(api.desk.mutations.resolve)

  const handleUnpin = async () => {
    await unpin({ id })
  }

  const handleComplete = async () => {
    await resolve({ id, resolution: 'completed' })
  }

  return (
    <DeskCard
      title={title}
      description={description}
      icon={<Pin className="h-4 w-4 text-amber-500" />}
      actions={
        <>
          {linkedEntityType && (
            <Button variant="outline" size="sm">
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleComplete}>
            <Check className="h-3 w-3 mr-1" />
            Done
          </Button>
          <Button variant="ghost" size="sm" onClick={handleUnpin}>
            Unpin
          </Button>
        </>
      }
    />
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/PinnedCard.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add PinnedCard component for pinned zone

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.7: Create NeedsAttentionZone Component

**Files:**

- Create: `components/desk/NeedsAttentionZone.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DeskZone } from './DeskZone'
import { ApprovalCard } from './ApprovalCard'
import { AlertCircle } from 'lucide-react'

export function NeedsAttentionZone() {
  const items = useQuery(api.desk.queries.listByZone, { zone: 'attention' })

  if (!items) {
    return (
      <DeskZone title="NEEDS ATTENTION" icon={<AlertCircle className="h-4 w-4 text-red-500" />}>
        <div className="animate-pulse h-20 bg-muted rounded-lg" />
      </DeskZone>
    )
  }

  return (
    <DeskZone
      title="NEEDS ATTENTION"
      icon={<AlertCircle className="h-4 w-4 text-red-500" />}
      isEmpty={items.length === 0}
      emptyMessage="All clear!"
    >
      {items.map((item) => (
        <ApprovalCard
          key={item._id}
          id={item._id}
          title={item.title}
          description={item.description}
          type={item.type as 'draft' | 'approval' | 'question'}
          data={item.data as ApprovalCard['data']}
        />
      ))}
    </DeskZone>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/NeedsAttentionZone.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add NeedsAttentionZone component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.8: Create PinnedZone Component

**Files:**

- Create: `components/desk/PinnedZone.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DeskZone } from './DeskZone'
import { PinnedCard } from './PinnedCard'
import { Pin } from 'lucide-react'

export function PinnedZone() {
  const items = useQuery(api.desk.queries.listByZone, { zone: 'pinned' })

  if (!items) {
    return (
      <DeskZone title="PINNED" icon={<Pin className="h-4 w-4" />}>
        <div className="animate-pulse h-20 bg-muted rounded-lg" />
      </DeskZone>
    )
  }

  if (items.length === 0) {
    return null // Don't show pinned zone if empty
  }

  return (
    <DeskZone title="PINNED" icon={<Pin className="h-4 w-4" />}>
      {items.map((item) => (
        <PinnedCard
          key={item._id}
          id={item._id}
          title={item.title}
          description={item.description}
          linkedEntityType={item.linkedEntityType}
          linkedEntityId={item.linkedEntityId}
        />
      ))}
    </DeskZone>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/PinnedZone.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add PinnedZone component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.9: Create WorkingOnZone Component

**Files:**

- Create: `components/desk/WorkingOnZone.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DeskZone } from './DeskZone'
import { ProgressCard } from './ProgressCard'
import { Hourglass } from 'lucide-react'

export function WorkingOnZone() {
  const items = useQuery(api.desk.queries.listByZone, { zone: 'working' })

  if (!items) {
    return null // Don't show loading state for working zone
  }

  if (items.length === 0) {
    return null // Don't show working zone if empty
  }

  return (
    <DeskZone title="ARLO IS WORKING ON" icon={<Hourglass className="h-4 w-4" />}>
      {items.map((item) => {
        const data = item.data as
          | {
              operation?: string
              percent?: number
              status?: 'running' | 'completed' | 'failed'
            }
          | undefined
        return (
          <ProgressCard
            key={item._id}
            title={item.title}
            description={data?.operation}
            percent={data?.percent}
            status={data?.status || 'running'}
          />
        )
      })}
    </DeskZone>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/WorkingOnZone.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add WorkingOnZone component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.10: Create Main DeskPanel Component

**Files:**

- Create: `components/desk/DeskPanel.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TodaySection } from './TodaySection'
import { NeedsAttentionZone } from './NeedsAttentionZone'
import { PinnedZone } from './PinnedZone'
import { WorkingOnZone } from './WorkingOnZone'
import { ActivityLog } from './ActivityLog'

type Tab = 'desk' | 'activity'

export function DeskPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('desk')

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex border-b px-4">
        <button
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'desk'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('desk')}
        >
          Desk
        </button>
        <button
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'activity'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'desk' ? (
          <div className="space-y-6">
            <TodaySection />
            <NeedsAttentionZone />
            <PinnedZone />
            <WorkingOnZone />
          </div>
        ) : (
          <ActivityLog />
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/desk/DeskPanel.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add main DeskPanel component with tabs

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.11: Create ActivityLog Component

**Files:**

- Create: `components/desk/ActivityLog.tsx`

**Step 1: Write the component**

```tsx
'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { formatDistanceToNow } from 'date-fns'

export function ActivityLog() {
  const activities = useQuery(api.activity.list, { limit: 50 })

  if (!activities) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse h-12 bg-muted rounded" />
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No activity yet</p>
  }

  // Group by date
  const grouped = activities.reduce<Record<string, typeof activities>>((acc, activity) => {
    const date = new Date(activity._creationTime).toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(activity)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            {date === new Date().toLocaleDateString() ? 'Today' : date}
          </h3>
          <div className="space-y-2">
            {items.map((activity) => (
              <div key={activity._id} className="flex items-start gap-3 text-sm">
                <span className="text-xs text-muted-foreground w-16 flex-shrink-0">
                  {formatDistanceToNow(activity._creationTime, {
                    addSuffix: true,
                  })}
                </span>
                <div>
                  <span
                    className={cn(
                      'inline-block w-2 h-2 rounded-full mr-2',
                      activity.actor === 'arlo' ? 'bg-blue-500' : 'bg-green-500'
                    )}
                  />
                  <span>{activity.action}</span>
                  {activity.outcome && (
                    <span className="text-muted-foreground"> — {activity.outcome}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
```

**Step 2: Commit**

```bash
git add components/desk/ActivityLog.tsx
git commit -m "$(cat <<'EOF'
feat(desk): add ActivityLog component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.12: Create Desk Component Index

**Files:**

- Create: `components/desk/index.ts`

**Step 1: Write the barrel export**

```typescript
export { DeskPanel } from './DeskPanel'
export { DeskCard } from './DeskCard'
export { DeskZone } from './DeskZone'
export { TodaySection } from './TodaySection'
export { NeedsAttentionZone } from './NeedsAttentionZone'
export { PinnedZone } from './PinnedZone'
export { WorkingOnZone } from './WorkingOnZone'
export { ActivityLog } from './ActivityLog'
export { ApprovalCard } from './ApprovalCard'
export { PinnedCard } from './PinnedCard'
export { ProgressCard } from './ProgressCard'
```

**Step 2: Commit**

```bash
git add components/desk/index.ts
git commit -m "$(cat <<'EOF'
feat(desk): add component barrel export

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Layout Integration

### Task 4.1: Replace TaskList with DeskPanel in Chat Mode

**Files:**

- Modify: `app/page.tsx` (or wherever ChatMode renders canvas panel)

**Step 1: Read the current page.tsx**

Run: Read `app/page.tsx` to understand current structure

**Step 2: Replace TaskList import with DeskPanel**

Change:

```tsx
import { TaskList } from '@/components/TaskList'
```

To:

```tsx
import { DeskPanel } from '@/components/desk'
```

**Step 3: Replace TaskList usage with DeskPanel**

In the canvas panel section, change:

```tsx
<TaskList />
```

To:

```tsx
<DeskPanel />
```

**Step 4: Run the app to verify**

Run: `pnpm dev`
Expected: App loads with DeskPanel in right panel

**Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(desk): replace TaskList with DeskPanel in chat mode

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Tool Integration

### Task 5.1: Add createDeskItem Tool for Arlo

**Files:**

- Modify: `convex/arlo/tools.ts`

**Step 1: Read the current tools file**

Run: Read `convex/arlo/tools.ts` to understand current tool structure

**Step 2: Add the createDeskItem tool**

Add to the tools array:

```typescript
const createDeskItem = tool({
  description:
    'Create an item on the shared desk. Use for drafts needing approval, questions needing answers, or progress updates.',
  parameters: z.object({
    type: z.enum(['approval', 'question', 'draft', 'progress']).describe('Type of desk item'),
    zone: z.enum(['attention', 'pinned', 'working']).describe('Where to place the item'),
    title: z.string().describe('Brief title for the item'),
    description: z.string().optional().describe('Additional context'),
    data: z
      .object({
        // For approvals
        actions: z
          .array(
            z.object({
              id: z.string(),
              label: z.string(),
              variant: z.enum(['primary', 'secondary', 'destructive']),
            })
          )
          .optional(),
        // For questions
        question: z.string().optional(),
        options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
        // For drafts
        draftType: z.enum(['email']).optional(),
        to: z.string().optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
        // For progress
        operation: z.string().optional(),
        percent: z.number().optional(),
        status: z.enum(['running', 'completed', 'failed']).optional(),
      })
      .optional()
      .describe('Type-specific data'),
  }),
  execute: async (args, { userId, ctx }) => {
    const itemId = await ctx.runMutation(internal.desk.mutations.createInternal, {
      userId,
      type: args.type,
      zone: args.zone,
      title: args.title,
      description: args.description,
      data: args.data,
    })

    await ctx.runMutation(internal.activity.log, {
      userId,
      action: `Added "${args.title}" to desk`,
      actor: 'arlo',
      outcome: `In ${args.zone} zone`,
    })

    return { success: true, deskItemId: itemId }
  },
})
```

**Step 3: Add to tools array export**

**Step 4: Run typecheck to verify**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add convex/arlo/tools.ts
git commit -m "$(cat <<'EOF'
feat(desk): add createDeskItem tool for Arlo

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.2: Update draftEmail Tool to Create Desk Item

**Files:**

- Modify: `convex/arlo/gmailActions.ts`

**Step 1: Read the current gmailActions file**

Run: Read `convex/arlo/gmailActions.ts` to find draftEmail tool

**Step 2: Modify draftEmail to create desk item**

When creating a draft that needs confirmation, also create a desk item:

```typescript
// After creating the draft, add to desk
await ctx.runMutation(internal.desk.mutations.createInternal, {
  userId,
  type: 'draft',
  zone: 'attention',
  title: `Email to ${to}`,
  description: subject,
  data: {
    draftType: 'email',
    to,
    subject,
    body,
    actions: [
      { id: 'send', label: 'Send', variant: 'primary' },
      { id: 'edit', label: 'Edit', variant: 'secondary' },
      { id: 'discard', label: 'Discard', variant: 'destructive' },
    ],
  },
  linkedEntityId: draftId,
  linkedEntityType: 'emailDraft',
})
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add convex/arlo/gmailActions.ts
git commit -m "$(cat <<'EOF'
feat(desk): email drafts create desk items for approval

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.3: Update System Prompt to Reference Desk

**Files:**

- Modify: `convex/arlo/systemPrompt.ts`

**Step 1: Read the current system prompt**

Run: Read `convex/arlo/systemPrompt.ts`

**Step 2: Add desk instructions**

Add to the system prompt:

```typescript
## Shared Desk

You and the user share a desk - a persistent workspace visible in the right panel.

**When to use the desk:**
- Email drafts needing approval → createDeskItem with type "draft", zone "attention"
- Questions needing user decision → createDeskItem with type "question", zone "attention"
- Long-running operations → createDeskItem with type "progress", zone "working"

**When NOT to use the desk:**
- Simple informational responses → just reply in chat
- Tasks created via createTask → they appear in Today section automatically

**Reference desk items naturally:**
- "The email draft is on our desk for your review."
- "I've put a question on the desk about Friday's meeting."
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add convex/arlo/systemPrompt.ts
git commit -m "$(cat <<'EOF'
feat(desk): update system prompt with desk instructions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Testing & Polish

### Task 6.1: Run Full Test Suite

**Step 1: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Fix any failures**

If tests fail, debug and fix.

**Step 3: Run type check**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Run lint**

Run: `pnpm lint`
Expected: No errors (or only warnings)

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: resolve test and lint issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.2: Manual Integration Test

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test Today section**

- Create a task with due date today
- Verify it appears in Today section
- Create an overdue task
- Verify it shows in overdue with correct day count

**Step 3: Test Needs Attention**

- In chat, ask Arlo to draft an email
- Verify email draft appears in Needs Attention zone
- Click Send, verify it resolves
- Verify activity logged

**Step 4: Test Pinned**

- From Needs Attention, click Pin on an item
- Verify it moves to Pinned zone
- Click Unpin, verify it moves back

**Step 5: Test Activity tab**

- Switch to Activity tab
- Verify recent actions appear grouped by date

**Step 6: Document any issues**

Create issues or fix inline.

---

### Task 6.3: Final Commit

**Step 1: Run checks**

Run: `pnpm check`
Expected: All pass

**Step 2: Create final commit if needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(desk): complete shared desk implementation

- Today section with tasks due and overdue
- Needs Attention zone for approvals and questions
- Pinned zone for user-prioritized items
- Working On zone for progress tracking
- Activity log tab
- Tool integration for Arlo to create desk items
- Email drafts automatically appear on desk

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan implements the Shared Desk feature in 6 phases:

1. **Database & CRUD** - Schema, types, queries, mutations
2. **Today Section** - Computed view of daily tasks/calendar
3. **UI Components** - Cards, zones, panels
4. **Layout Integration** - Replace TaskList with DeskPanel
5. **Tool Integration** - Arlo can create desk items
6. **Testing & Polish** - Verify everything works

Each task is 2-5 minutes of focused work following TDD principles.
