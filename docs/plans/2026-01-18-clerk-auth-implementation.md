# Clerk Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Clerk authentication with full multi-user data isolation.

**Architecture:** Clerk handles auth, webhooks sync users to Convex, all data scoped by userId. Middleware protects routes, Clerk components handle sign-in/sign-up UI.

**Tech Stack:** Clerk, Convex, Next.js 15, svix (webhook verification)

---

## Prerequisites (Manual Steps)

Before starting implementation:

1. **Create Clerk account** at clerk.com
2. **Create new application** in Clerk dashboard
3. **Enable Google OAuth** in Clerk → User & Authentication → Social Connections
4. **Create JWT Template** in Clerk → JWT Templates → New template → Convex
   - Copy the "Issuer" URL (looks like `https://your-app.clerk.accounts.dev`)
5. **Get API keys** from Clerk → API Keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_`)
   - `CLERK_SECRET_KEY` (starts with `sk_`)

---

## Task 1: Create Feature Branch

**Step 1: Create and checkout branch**

```bash
git checkout -b feature/clerk-auth
```

**Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `feature/clerk-auth`

---

## Task 2: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install Clerk and svix**

```bash
pnpm add @clerk/nextjs svix
```

**Step 2: Verify installation**

```bash
pnpm list @clerk/nextjs svix
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Clerk and svix dependencies"
```

---

## Task 3: Add Environment Variables

**Files:**

- Modify: `.env.local`
- Modify: Convex environment (via CLI)

**Step 1: Add to `.env.local`**

```bash
# Add these lines to .env.local (replace with your actual values)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

**Step 2: Set Convex environment variables**

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://your-app.clerk.accounts.dev"
```

Note: Webhook secret will be added later after configuring webhook in Clerk dashboard.

**Step 3: Update `.env.local.example`**

Add to `.env.local.example`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

**Step 4: Commit example file only**

```bash
git add .env.local.example
git commit -m "docs: add Clerk env vars to example"
```

---

## Task 4: Create Convex Auth Config

**Files:**

- Create: `convex/auth.config.ts`

**Step 1: Create auth config file**

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: 'convex',
    },
  ],
}
```

**Step 2: Verify Convex picks up the config**

```bash
npx convex dev
```

Expected: No errors, should see "Convex functions ready"

**Step 3: Commit**

```bash
git add convex/auth.config.ts
git commit -m "feat: add Convex auth config for Clerk"
```

---

## Task 5: Update Schema with Users Table and userId

**Files:**

- Modify: `convex/schema.ts`

**Step 1: Update schema**

Replace entire contents of `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Users synced from Clerk
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email']),

  folders: defineTable({
    userId: v.id('users'),
    name: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  projects: defineTable({
    userId: v.id('users'),
    name: v.string(),
    folderId: v.optional(v.id('folders')),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_folder', ['folderId']),

  sections: defineTable({
    userId: v.id('users'),
    name: v.string(),
    projectId: v.id('projects'),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_project', ['projectId']),

  tasks: defineTable({
    userId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    status: v.union(v.literal('pending'), v.literal('completed')),
    priority: v.optional(
      v.union(v.literal('none'), v.literal('low'), v.literal('medium'), v.literal('high'))
    ),
    dueDate: v.optional(v.number()),
    reminders: v.optional(v.array(v.number())),
    sortOrder: v.optional(v.number()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_project', ['projectId'])
    .index('by_due_date', ['dueDate']),

  subtasks: defineTable({
    userId: v.id('users'),
    title: v.string(),
    taskId: v.id('tasks'),
    completed: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_task', ['taskId']),

  notes: defineTable({
    userId: v.id('users'),
    title: v.string(),
    content: v.string(),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    sortOrder: v.optional(v.number()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_project', ['projectId'])
    .index('by_updated', ['updatedAt']),

  activity: defineTable({
    userId: v.id('users'),
    action: v.string(),
    actor: v.union(v.literal('user'), v.literal('arlo')),
    outcome: v.union(v.literal('success'), v.literal('error')),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_created_at', ['createdAt']),
})
```

**Step 2: Commit schema changes**

```bash
git add convex/schema.ts
git commit -m "feat: add users table and userId to all tables"
```

---

## Task 6: Wipe Existing Data

**Step 1: Open Convex dashboard**

```bash
npx convex dashboard
```

**Step 2: Clear all tables**

In the Convex dashboard:

1. Go to "Data" tab
2. For each table (folders, projects, sections, tasks, subtasks, notes, activity):
   - Click the table
   - Select all documents
   - Delete all

**Step 3: Verify tables are empty**

Check each table shows 0 documents.

---

## Task 7: Create Auth Helper Functions

**Files:**

- Create: `convex/lib/auth.ts`

**Step 1: Create lib directory and auth helpers**

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server'

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique()

  return user
}

export async function requireCurrentUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx)
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function getCurrentUserFromAction(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return { clerkId: identity.subject }
}
```

**Step 2: Commit**

```bash
git add convex/lib/auth.ts
git commit -m "feat: add auth helper functions"
```

---

## Task 8: Create Users Module

**Files:**

- Create: `convex/users.ts`

**Step 1: Create users mutations**

```typescript
// convex/users.ts
import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

export const upsert = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const deleteByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique()

    if (user) {
      // Note: In production, you might want to cascade delete or anonymize user data
      await ctx.db.delete(user._id)
    }
  },
})

export const getByClerkId = internalQuery({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
      .unique()
  },
})
```

**Step 2: Commit**

```bash
git add convex/users.ts
git commit -m "feat: add users module with upsert/delete mutations"
```

---

## Task 9: Create Webhook Handler

**Files:**

- Create: `convex/http.ts`

**Step 1: Create HTTP router with Clerk webhook**

```typescript
// convex/http.ts
import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { Webhook } from 'svix'

const http = httpRouter()

// Clerk webhook types
interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name: string | null
    last_name: string | null
    image_url: string | null
  }
}

http.route({
  path: '/webhooks/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('CLERK_WEBHOOK_SECRET not set')
      return new Response('Webhook secret not configured', { status: 500 })
    }

    // Get headers
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing svix headers', { status: 400 })
    }

    // Get body
    const payload = await request.text()

    // Verify webhook
    const wh = new Webhook(webhookSecret)
    let event: ClerkWebhookEvent

    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent
    } catch (err) {
      console.error('Webhook verification failed:', err)
      return new Response('Invalid signature', { status: 401 })
    }

    // Handle event
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const name =
          `${event.data.first_name ?? ''} ${event.data.last_name ?? ''}`.trim() || undefined

        await ctx.runMutation(internal.users.upsert, {
          clerkId: event.data.id,
          email: event.data.email_addresses[0]?.email_address ?? '',
          name,
          imageUrl: event.data.image_url ?? undefined,
        })
        break
      }

      case 'user.deleted':
        await ctx.runMutation(internal.users.deleteByClerkId, {
          clerkId: event.data.id,
        })
        break
    }

    return new Response('OK', { status: 200 })
  }),
})

export default http
```

**Step 2: Commit**

```bash
git add convex/http.ts
git commit -m "feat: add Clerk webhook handler"
```

---

## Task 10: Update ConvexProvider with Clerk

**Files:**

- Modify: `components/ConvexProvider.tsx`

**Step 1: Update provider**

Replace entire contents of `components/ConvexProvider.tsx`:

```typescript
'use client'

import { ClerkProvider, useAuth } from '@clerk/nextjs'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import { ReactNode } from 'react'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
```

**Step 2: Commit**

```bash
git add components/ConvexProvider.tsx
git commit -m "feat: integrate Clerk with Convex provider"
```

---

## Task 11: Create Middleware for Route Protection

**Files:**

- Create: `middleware.ts`

**Step 1: Create middleware**

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

**Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Clerk middleware for route protection"
```

---

## Task 12: Create Sign-In Page

**Files:**

- Create: `app/sign-in/[[...sign-in]]/page.tsx`

**Step 1: Create directory and page**

```typescript
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-none bg-background',
          },
        }}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/sign-in/
git commit -m "feat: add sign-in page"
```

---

## Task 13: Create Sign-Up Page

**Files:**

- Create: `app/sign-up/[[...sign-up]]/page.tsx`

**Step 1: Create directory and page**

```typescript
// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-none bg-background',
          },
        }}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/sign-up/
git commit -m "feat: add sign-up page"
```

---

## Task 14: Update Folders Module

**Files:**

- Modify: `convex/folders.ts`

**Step 1: Update with userId scoping**

Replace entire contents of `convex/folders.ts`:

```typescript
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('folders')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})

export const get = query({
  args: { id: v.id('folders') },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const folder = await ctx.db.get(args.id)
    if (!folder || folder.userId !== user._id) return null
    return folder
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const folders = await ctx.db
      .query('folders')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const maxSortOrder = folders.reduce((max, f) => Math.max(max, f.sortOrder), -1)

    return await ctx.db.insert('folders', {
      userId: user._id,
      name: args.name,
      color: args.color,
      icon: args.icon,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('folders'),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const folder = await ctx.db.get(args.id)
    if (!folder || folder.userId !== user._id) throw new Error('Not found')

    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered)
    }
  },
})

export const remove = mutation({
  args: { id: v.id('folders') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const folder = await ctx.db.get(id)
    if (!folder || folder.userId !== user._id) throw new Error('Not found')

    // Move projects in this folder to have no folder (Inbox)
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_folder', (q) => q.eq('folderId', id))
      .collect()

    for (const project of projects) {
      if (project.userId === user._id) {
        await ctx.db.patch(project._id, { folderId: undefined })
      }
    }

    await ctx.db.delete(id)
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('folders')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const folder = await ctx.db.get(orderedIds[i])
      if (folder && folder.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})
```

**Step 2: Commit**

```bash
git add convex/folders.ts
git commit -m "feat: add userId scoping to folders"
```

---

## Task 15: Update Projects Module

**Files:**

- Modify: `convex/projects.ts`

**Step 1: Update with userId scoping**

Replace entire contents of `convex/projects.ts`:

```typescript
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})

export const listByFolder = query({
  args: { folderId: v.optional(v.id('folders')) },
  handler: async (ctx, { folderId }) => {
    const user = await requireCurrentUser(ctx)
    const allProjects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    if (folderId === undefined) {
      return allProjects.filter((p) => p.folderId === undefined)
    }
    return allProjects.filter((p) => p.folderId === folderId)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    folderId: v.optional(v.id('folders')),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const maxSortOrder = projects.reduce((max, p) => Math.max(max, p.sortOrder), -1)

    return await ctx.db.insert('projects', {
      userId: user._id,
      name: args.name,
      folderId: args.folderId,
      color: args.color,
      icon: args.icon,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('projects'),
    name: v.optional(v.string()),
    folderId: v.optional(v.id('folders')),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const project = await ctx.db.get(args.id)
    if (!project || project.userId !== user._id) throw new Error('Not found')

    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered)
    }
  },
})

export const remove = mutation({
  args: { id: v.id('projects') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const project = await ctx.db.get(id)
    if (!project || project.userId !== user._id) throw new Error('Not found')

    // Delete all sections in this project
    const sections = await ctx.db
      .query('sections')
      .withIndex('by_project', (q) => q.eq('projectId', id))
      .collect()

    for (const section of sections) {
      await ctx.db.delete(section._id)
    }

    // Move tasks in this project to have no project
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', id))
      .collect()

    for (const task of tasks) {
      await ctx.db.patch(task._id, { projectId: undefined, sectionId: undefined })
    }

    await ctx.db.delete(id)
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('projects')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const project = await ctx.db.get(orderedIds[i])
      if (project && project.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})

export const moveToFolder = mutation({
  args: {
    id: v.id('projects'),
    folderId: v.optional(v.id('folders')),
  },
  handler: async (ctx, { id, folderId }) => {
    const user = await requireCurrentUser(ctx)
    const project = await ctx.db.get(id)
    if (!project || project.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { folderId })
  },
})
```

**Step 2: Commit**

```bash
git add convex/projects.ts
git commit -m "feat: add userId scoping to projects"
```

---

## Task 16: Update Sections Module

**Files:**

- Modify: `convex/sections.ts`

**Step 1: Update with userId scoping**

Replace entire contents of `convex/sections.ts`:

```typescript
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const user = await requireCurrentUser(ctx)
    const sections = await ctx.db
      .query('sections')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
    return sections.filter((s) => s.userId === user._id)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId)
    if (!project || project.userId !== user._id) throw new Error('Project not found')

    const sections = await ctx.db
      .query('sections')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()
    const maxSortOrder = sections.reduce((max, s) => Math.max(max, s.sortOrder), -1)

    return await ctx.db.insert('sections', {
      userId: user._id,
      name: args.name,
      projectId: args.projectId,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('sections'),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await requireCurrentUser(ctx)
    const section = await ctx.db.get(id)
    if (!section || section.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { name })
  },
})

export const remove = mutation({
  args: { id: v.id('sections') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const section = await ctx.db.get(id)
    if (!section || section.userId !== user._id) throw new Error('Not found')

    // Move tasks in this section to have no section
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', section.projectId))
      .collect()

    for (const task of tasks) {
      if (task.sectionId === id && task.userId === user._id) {
        await ctx.db.patch(task._id, { sectionId: undefined })
      }
    }

    await ctx.db.delete(id)
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('sections')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const section = await ctx.db.get(orderedIds[i])
      if (section && section.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})
```

**Step 2: Commit**

```bash
git add convex/sections.ts
git commit -m "feat: add userId scoping to sections"
```

---

## Task 17: Update Tasks Module

**Files:**

- Modify: `convex/tasks.ts`

**Step 1: Update with userId scoping**

Replace entire contents of `convex/tasks.ts`:

```typescript
import { mutation, query, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'
import { Id } from './_generated/dataModel'

const priorityValidator = v.union(
  v.literal('none'),
  v.literal('low'),
  v.literal('medium'),
  v.literal('high')
)

// Public query for UI to list all tasks
export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()
  },
})

// List tasks by project
export const listByProject = query({
  args: { projectId: v.optional(v.id('projects')) },
  handler: async (ctx, { projectId }) => {
    const user = await requireCurrentUser(ctx)
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    if (projectId === undefined) {
      return allTasks.filter((t) => t.projectId === undefined)
    }
    return allTasks.filter((t) => t.projectId === projectId)
  },
})

// List tasks due today
export const listToday = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    return tasks.filter(
      (t) =>
        t.status === 'pending' &&
        t.dueDate !== undefined &&
        t.dueDate >= startOfDay &&
        t.dueDate <= endOfDay
    )
  },
})

// List tasks due in next 7 days
export const listNext7Days = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const endOfWeek = startOfDay + 7 * 24 * 60 * 60 * 1000 - 1

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    return tasks.filter(
      (t) =>
        t.status === 'pending' &&
        t.dueDate !== undefined &&
        t.dueDate >= startOfDay &&
        t.dueDate <= endOfWeek
    )
  },
})

// Public mutation for UI to create tasks
export const createFromUI = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Get max sort order for the project/section
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const existingTasks = args.projectId
      ? allTasks.filter((t) => t.projectId === args.projectId)
      : allTasks.filter((t) => t.projectId === undefined)

    const relevantTasks = args.sectionId
      ? existingTasks.filter((t) => t.sectionId === args.sectionId)
      : existingTasks.filter((t) => t.sectionId === undefined)

    const maxSortOrder = relevantTasks.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), -1)

    return await ctx.db.insert('tasks', {
      userId: user._id,
      title: args.title,
      description: args.description,
      projectId: args.projectId,
      sectionId: args.sectionId,
      status: 'pending',
      priority: args.priority ?? 'none',
      dueDate: args.dueDate,
      reminders: [],
      sortOrder: maxSortOrder + 1,
      createdBy: 'user',
      createdAt: Date.now(),
    })
  },
})

// Update task
export const update = mutation({
  args: {
    id: v.id('tasks'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
    reminders: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(args.id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered)
    }
  },
})

// Clear optional fields (for removing values)
export const clearField = mutation({
  args: {
    id: v.id('tasks'),
    field: v.union(
      v.literal('description'),
      v.literal('projectId'),
      v.literal('sectionId'),
      v.literal('dueDate')
    ),
  },
  handler: async (ctx, { id, field }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { [field]: undefined })
  },
})

// Public mutation for UI to complete tasks
export const completeFromUI = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(taskId, {
      status: 'completed',
      completedAt: Date.now(),
    })
  },
})

// Reopen a completed task
export const reopen = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(taskId, {
      status: 'pending',
      completedAt: undefined,
    })
  },
})

// Delete task
export const remove = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    // Delete all subtasks
    const subtasks = await ctx.db
      .query('subtasks')
      .withIndex('by_task', (q) => q.eq('taskId', id))
      .collect()

    for (const subtask of subtasks) {
      await ctx.db.delete(subtask._id)
    }

    await ctx.db.delete(id)
  },
})

// Reorder tasks
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('tasks')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const task = await ctx.db.get(orderedIds[i])
      if (task && task.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})

// Move task to project/section
export const move = mutation({
  args: {
    id: v.id('tasks'),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { id, projectId, sectionId }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { projectId, sectionId })
  },
})

// Move task to a different project (drag and drop)
export const moveToProject = mutation({
  args: {
    id: v.id('tasks'),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { id, projectId, sectionId }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    // Get existing tasks in the target project
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const targetTasks = projectId
      ? allTasks.filter((t) => t.projectId === projectId)
      : allTasks.filter((t) => t.projectId === undefined)

    const sectionTasks = targetTasks.filter((t) =>
      sectionId ? t.sectionId === sectionId : t.sectionId === undefined
    )

    const minSortOrder = sectionTasks.reduce((min, t) => Math.min(min, t.sortOrder ?? 0), 0)

    await ctx.db.patch(id, {
      projectId,
      sectionId,
      sortOrder: minSortOrder - 1,
    })
  },
})

// Set due date to today
export const setDueToday = mutation({
  args: {
    id: v.id('tasks'),
  },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    await ctx.db.patch(id, { dueDate: startOfDay })
  },
})

// Add reminder
export const addReminder = mutation({
  args: {
    id: v.id('tasks'),
    reminderTime: v.number(),
  },
  handler: async (ctx, { id, reminderTime }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    const reminders = [...(task.reminders ?? []), reminderTime].sort((a, b) => a - b)
    await ctx.db.patch(id, { reminders })
  },
})

// Remove reminder
export const removeReminder = mutation({
  args: {
    id: v.id('tasks'),
    reminderTime: v.number(),
  },
  handler: async (ctx, { id, reminderTime }) => {
    const user = await requireCurrentUser(ctx)
    const task = await ctx.db.get(id)
    if (!task || task.userId !== user._id) throw new Error('Not found')

    const reminders = (task.reminders ?? []).filter((r) => r !== reminderTime)
    await ctx.db.patch(id, { reminders })
  },
})

// Internal mutation for Arlo to create tasks
export const create = internalMutation({
  args: {
    userId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  },
  handler: async (ctx, args) => {
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const existingTasks = args.projectId
      ? allTasks.filter((t) => t.projectId === args.projectId)
      : allTasks.filter((t) => t.projectId === undefined)

    const maxSortOrder = existingTasks.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), -1)

    return await ctx.db.insert('tasks', {
      userId: args.userId,
      title: args.title,
      description: args.description,
      projectId: args.projectId,
      sectionId: args.sectionId,
      status: 'pending',
      priority: args.priority ?? 'none',
      dueDate: args.dueDate,
      reminders: [],
      sortOrder: maxSortOrder + 1,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    })
  },
})

// Internal query for Arlo to list pending tasks
export const listPending = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    return tasks.filter((t) => t.status === 'pending')
  },
})

// Internal mutation for Arlo to complete tasks
export const complete = internalMutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    await ctx.db.patch(taskId, {
      status: 'completed',
      completedAt: Date.now(),
    })
  },
})
```

**Step 2: Commit**

```bash
git add convex/tasks.ts
git commit -m "feat: add userId scoping to tasks"
```

---

## Task 18: Update Subtasks Module

**Files:**

- Modify: `convex/subtasks.ts`

**Step 1: Update with userId scoping**

Replace entire contents of `convex/subtasks.ts`:

```typescript
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const listByTask = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const user = await requireCurrentUser(ctx)

    // Verify task belongs to user
    const task = await ctx.db.get(taskId)
    if (!task || task.userId !== user._id) return []

    return await ctx.db
      .query('subtasks')
      .withIndex('by_task', (q) => q.eq('taskId', taskId))
      .collect()
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Verify task belongs to user
    const task = await ctx.db.get(args.taskId)
    if (!task || task.userId !== user._id) throw new Error('Task not found')

    const subtasks = await ctx.db
      .query('subtasks')
      .withIndex('by_task', (q) => q.eq('taskId', args.taskId))
      .collect()
    const maxSortOrder = subtasks.reduce((max, s) => Math.max(max, s.sortOrder), -1)

    return await ctx.db.insert('subtasks', {
      userId: user._id,
      title: args.title,
      taskId: args.taskId,
      completed: false,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('subtasks'),
    title: v.optional(v.string()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const subtask = await ctx.db.get(args.id)
    if (!subtask || subtask.userId !== user._id) throw new Error('Not found')

    const { id, ...updates } = args
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered)
    }
  },
})

export const remove = mutation({
  args: { id: v.id('subtasks') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const subtask = await ctx.db.get(id)
    if (!subtask || subtask.userId !== user._id) throw new Error('Not found')

    await ctx.db.delete(id)
  },
})

export const toggle = mutation({
  args: { id: v.id('subtasks') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const subtask = await ctx.db.get(id)
    if (!subtask || subtask.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { completed: !subtask.completed })
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('subtasks')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const subtask = await ctx.db.get(orderedIds[i])
      if (subtask && subtask.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})
```

**Step 2: Commit**

```bash
git add convex/subtasks.ts
git commit -m "feat: add userId scoping to subtasks"
```

---

## Task 19: Update Notes Module

**Files:**

- Modify: `convex/notes.ts`

**Step 1: Update with userId scoping**

Replace entire contents of `convex/notes.ts`:

```typescript
import { query, mutation, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { requireCurrentUser } from './lib/auth'

export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()
  },
})

export const listByProject = query({
  args: { projectId: v.optional(v.id('projects')) },
  handler: async (ctx, { projectId }) => {
    const user = await requireCurrentUser(ctx)
    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    if (projectId === undefined) {
      return allNotes.filter((n) => n.projectId === undefined)
    }
    return allNotes.filter((n) => n.projectId === projectId)
  },
})

export const get = query({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(id)
    if (!note || note.userId !== user._id) return null
    return note
  },
})

// Create note from UI
export const createFromUI = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const existingNotes = args.projectId
      ? allNotes.filter((n) => n.projectId === args.projectId)
      : allNotes.filter((n) => n.projectId === undefined)

    const relevantNotes = args.sectionId
      ? existingNotes.filter((n) => n.sectionId === args.sectionId)
      : existingNotes.filter((n) => n.sectionId === undefined)

    const maxSortOrder = relevantNotes.reduce((max, n) => Math.max(max, n.sortOrder ?? 0), -1)

    const now = Date.now()
    return await ctx.db.insert('notes', {
      userId: user._id,
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
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(args.id)
    if (!note || note.userId !== user._id) throw new Error('Not found')

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
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(id)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { content, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id('notes') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(id)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    await ctx.db.delete(id)
  },
})

export const moveToProject = mutation({
  args: {
    id: v.id('notes'),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, { id, projectId }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(id)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const targetNotes = projectId
      ? allNotes.filter((n) => n.projectId === projectId)
      : allNotes.filter((n) => n.projectId === undefined)

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
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < items.length; i++) {
      const { type, id } = items[i]
      if (type === 'task') {
        const task = await ctx.db.get(id as Id<'tasks'>)
        if (task && task.userId === user._id) {
          await ctx.db.patch(id as Id<'tasks'>, { sortOrder: i })
        }
      } else {
        const note = await ctx.db.get(id as Id<'notes'>)
        if (note && note.userId === user._id) {
          await ctx.db.patch(id as Id<'notes'>, { sortOrder: i })
        }
      }
    }
  },
})

export const moveToSection = mutation({
  args: {
    noteId: v.id('notes'),
    projectId: v.id('projects'),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { noteId, projectId, sectionId }) => {
    const user = await requireCurrentUser(ctx)
    const note = await ctx.db.get(noteId)
    if (!note || note.userId !== user._id) throw new Error('Not found')

    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const existingTasks = allTasks.filter((t) => t.projectId === projectId)
    const existingNotes = allNotes.filter((n) => n.projectId === projectId)

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

// Internal mutation for Arlo to create notes
export const create = internalMutation({
  args: {
    userId: v.id('users'),
    title: v.string(),
    content: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
  },
  handler: async (ctx, args) => {
    const allNotes = await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    const existingNotes = args.projectId
      ? allNotes.filter((n) => n.projectId === args.projectId)
      : allNotes.filter((n) => n.projectId === undefined)

    const maxSortOrder = existingNotes.reduce((max, n) => Math.max(max, n.sortOrder ?? 0), -1)

    const now = Date.now()
    return await ctx.db.insert('notes', {
      userId: args.userId,
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
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
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

**Step 2: Commit**

```bash
git add convex/notes.ts
git commit -m "feat: add userId scoping to notes"
```

---

## Task 20: Update Activity Module

**Files:**

- Modify: `convex/activity.ts`

**Step 1: Update with userId**

Replace entire contents of `convex/activity.ts`:

```typescript
import { internalMutation } from './_generated/server'
import { v } from 'convex/values'

export const log = internalMutation({
  args: {
    userId: v.id('users'),
    action: v.string(),
    actor: v.union(v.literal('user'), v.literal('arlo')),
    outcome: v.union(v.literal('success'), v.literal('error')),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('activity', {
      ...args,
      createdAt: Date.now(),
    })
  },
})
```

**Step 2: Commit**

```bash
git add convex/activity.ts
git commit -m "feat: add userId to activity logging"
```

---

## Task 21: Update Arlo Mutations

**Files:**

- Modify: `convex/arlo/mutations.ts`

**Step 1: Update with userId**

Replace entire contents of `convex/arlo/mutations.ts`:

```typescript
import { internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'

export const moveTask = internalMutation({
  args: {
    taskId: v.id('tasks'),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
  },
  handler: async (ctx, { taskId, projectId, sectionId }) => {
    await ctx.db.patch(taskId, { projectId, sectionId })
  },
})

export const addReminder = internalMutation({
  args: {
    taskId: v.id('tasks'),
    reminderTime: v.number(),
  },
  handler: async (ctx, { taskId, reminderTime }) => {
    const task = await ctx.db.get(taskId)
    if (!task) return

    const reminders = [...(task.reminders ?? []), reminderTime].sort((a, b) => a - b)
    await ctx.db.patch(taskId, { reminders })
  },
})

export const listProjectsAndFolders = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const folders = await ctx.db
      .query('folders')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    return {
      projects: projects.map((p) => ({
        id: p._id,
        name: p.name,
        folderId: p.folderId,
      })),
      folders: folders.map((f) => ({
        id: f._id,
        name: f.name,
      })),
    }
  },
})

export const updateTaskPriority = internalMutation({
  args: {
    taskId: v.id('tasks'),
    priority: v.union(v.literal('none'), v.literal('low'), v.literal('medium'), v.literal('high')),
  },
  handler: async (ctx, { taskId, priority }) => {
    await ctx.db.patch(taskId, { priority })
  },
})

export const updateTaskDueDate = internalMutation({
  args: {
    taskId: v.id('tasks'),
    dueDate: v.number(),
  },
  handler: async (ctx, { taskId, dueDate }) => {
    await ctx.db.patch(taskId, { dueDate })
  },
})
```

**Step 2: Commit**

```bash
git add convex/arlo/mutations.ts
git commit -m "feat: add userId to Arlo mutations"
```

---

## Task 22: Update Arlo Tools

**Files:**

- Modify: `convex/arlo/tools.ts`

This is a large file. The key changes are:

1. All tools need to receive `userId` from the agent context
2. Pass `userId` to all internal queries/mutations

**Step 1: Update tools**

The tools need to be updated to receive userId. Since the Arlo agent passes userId in context, update each tool to use it.

Key pattern for each tool:

```typescript
// In handler, get userId from context
handler: async (ctx, args): Promise<...> => {
  // The agent should pass userId - for now we'll need to get it from the thread context
  // This will be handled by the agent setup
  const userId = ctx.userId as Id<'users'>  // Agent passes this

  // Use userId in all internal calls
  await ctx.runMutation(internal.tasks.create, {
    userId,
    // ... other args
  })
}
```

**Note:** The full tools.ts update is extensive. The key changes:

- Add `userId` parameter to all `ctx.runMutation` and `ctx.runQuery` calls
- Update `internal.tasks.create`, `internal.tasks.listPending`, `internal.notes.create`, `internal.notes.listAll`, `internal.activity.log`, `internal.arlo.mutations.listProjectsAndFolders` to include `userId`

Due to the complexity, this task may need to be split into smaller steps during implementation.

**Step 2: Commit**

```bash
git add convex/arlo/tools.ts
git commit -m "feat: add userId to Arlo tools"
```

---

## Task 23: Update Arlo Agent

**Files:**

- Modify: `convex/arlo/agent.ts`

The agent needs to pass userId to tools. This depends on how `@convex-dev/agent` handles user context.

**Step 1: Research agent context passing**

Check the `@convex-dev/agent` documentation for how to pass user context to tools.

**Step 2: Update agent if needed**

The agent may need to be configured to pass the authenticated user's ID to tools.

**Step 3: Commit**

```bash
git add convex/arlo/agent.ts
git commit -m "feat: configure Arlo agent with user context"
```

---

## Task 24: Configure Clerk Webhook

**Manual step in Clerk dashboard:**

1. Go to Clerk Dashboard → Webhooks
2. Click "Add Endpoint"
3. Set URL to: `https://<your-convex-deployment>.convex.site/webhooks/clerk`
4. Select events: `user.created`, `user.updated`, `user.deleted`
5. Copy the signing secret
6. Set in Convex:

```bash
npx convex env set CLERK_WEBHOOK_SECRET "whsec_..."
```

---

## Task 25: Test End-to-End

**Step 1: Start dev server**

```bash
pnpm dev
```

**Step 2: Test sign-up flow**

1. Visit `http://localhost:3000`
2. Should redirect to `/sign-in`
3. Click "Sign up"
4. Create account with email or Google
5. Should redirect to main app
6. Check Convex dashboard - user should appear in `users` table

**Step 3: Test data isolation**

1. Create a task
2. Check Convex dashboard - task should have `userId`
3. Sign out
4. Sign in with different account
5. Should see empty task list (new user's data)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in testing"
```

---

## Task 26: Final Commit and PR

**Step 1: Run checks**

```bash
pnpm check
```

Fix any issues.

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete Clerk authentication implementation"
```

**Step 3: Push branch**

```bash
git push -u origin feature/clerk-auth
```

**Step 4: Create PR**

```bash
gh pr create --title "feat: Add Clerk authentication with multi-user support" --body "$(cat <<'EOF'
## Summary
- Adds Clerk authentication with email/password and Google OAuth
- Creates users table synced via webhooks
- Adds userId to all data tables for multi-user isolation
- Protects all routes except sign-in/sign-up
- Updates all Convex queries/mutations with user scoping

## Test plan
- [ ] Sign up with email works
- [ ] Sign up with Google works
- [ ] Sign in redirects to app
- [ ] Unauthenticated users redirect to sign-in
- [ ] Creating tasks/notes associates with current user
- [ ] Users only see their own data
- [ ] Clerk webhook creates user in Convex

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

---

## Summary

This plan covers:

1. Installing dependencies
2. Setting up Clerk configuration
3. Creating webhook handler for user sync
4. Updating frontend providers
5. Creating auth pages
6. Adding route protection
7. Updating all 8 Convex modules with userId scoping
8. Configuring Clerk dashboard
9. Testing and PR creation

Total estimated tasks: 26
