# Clerk Authentication Design

**Date:** 2026-01-18
**Status:** Approved
**Prerequisite for:** Nango integrations

## Overview

Add Clerk authentication to Arlo with full multi-user support. All data scoped by user, webhooks sync user records, routes protected by middleware.

## Architecture Decisions

- **Multi-user:** Yes, from the start
- **User sync:** Clerk webhooks (not client-side mutation)
- **User data:** Display-ready (clerkId, email, name, imageUrl)
- **Existing data:** Wipe and start fresh
- **Auth UI:** Clerk components (`<SignIn />`, `<SignUp />`)
- **Auth methods:** Email/password + Google OAuth
- **Public routes:** None (only sign-in/sign-up accessible without auth)

## Data Model

### Users Table

```typescript
// convex/schema.ts
users: defineTable({
  clerkId: v.string(),
  email: v.string(),
  name: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_clerk_id', ['clerkId'])
  .index('by_email', ['email'])
```

### Add userId to All Tables

```typescript
folders: defineTable({
  userId: v.id('users'), // Required
  name: v.string(),
  color: v.optional(v.string()),
  icon: v.optional(v.string()),
  sortOrder: v.number(),
  createdAt: v.number(),
}).index('by_user', ['userId'])

// Same pattern for: projects, tasks, notes, sections, subtasks, activity
```

## Clerk Webhook Handler

```typescript
// convex/http.ts
import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { Webhook } from 'svix'

const http = httpRouter()

http.route({
  path: '/webhooks/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    // 1. Verify webhook signature
    const svix = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
    const payload = await request.text()
    const headers = {
      'svix-id': request.headers.get('svix-id')!,
      'svix-timestamp': request.headers.get('svix-timestamp')!,
      'svix-signature': request.headers.get('svix-signature')!,
    }

    const event = svix.verify(payload, headers) as ClerkWebhookEvent

    // 2. Handle event types
    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await ctx.runMutation(internal.users.upsert, {
          clerkId: event.data.id,
          email: event.data.email_addresses[0]?.email_address,
          name: `${event.data.first_name ?? ''} ${event.data.last_name ?? ''}`.trim() || null,
          imageUrl: event.data.image_url,
        })
        break

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

**Webhook URL:** `https://<deployment>.convex.site/webhooks/clerk`

## Frontend Provider Setup

```typescript
// components/ConvexProvider.tsx
"use client"

import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ConvexReactClient } from "convex/react"
import { ReactNode } from "react"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
```

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

## Auth Pages

```typescript
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
```

```typescript
// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  )
}
```

## Route Protection

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
    '/((?!_next|[^?]*\\.(?:html?|css|js|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

## Accessing Users in Convex

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from '../_generated/server'

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
```

**Query pattern:**

```typescript
export const list = query({
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})
```

**Mutation pattern:**

```typescript
export const create = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    return await ctx.db.insert('tasks', {
      ...args,
      userId: user._id,
      createdAt: Date.now(),
    })
  },
})
```

## File Structure

```
convex/
├── auth.config.ts               # NEW - Clerk JWT config
├── schema.ts                    # MODIFY - add users, userId to all tables
├── http.ts                      # NEW - Clerk webhook handler
├── users.ts                     # NEW - upsert/delete mutations
├── lib/auth.ts                  # NEW - getCurrentUser helpers
├── tasks.ts                     # MODIFY - add userId scoping
├── notes.ts                     # MODIFY
├── projects.ts                  # MODIFY
├── folders.ts                   # MODIFY
├── sections.ts                  # MODIFY
├── activity.ts                  # MODIFY
└── arlo/
    ├── agent.ts                 # MODIFY - pass userId context
    └── tools.ts                 # MODIFY - scope to user

app/
├── sign-in/[[...sign-in]]/page.tsx   # NEW
├── sign-up/[[...sign-up]]/page.tsx   # NEW
└── middleware.ts                      # NEW

components/
└── ConvexProvider.tsx           # MODIFY - add ClerkProvider
```

## Implementation Order

1. Create Clerk account, configure Google OAuth
2. Add env vars (Clerk keys, webhook secret)
3. `convex/auth.config.ts`
4. `convex/schema.ts` — add users table, userId to all tables
5. Wipe existing data
6. `convex/users.ts` — upsert/delete mutations
7. `convex/http.ts` — Clerk webhook handler
8. `convex/lib/auth.ts` — helper functions
9. `components/ConvexProvider.tsx` — add Clerk
10. `middleware.ts` — route protection
11. Sign-in/sign-up pages
12. Update all queries/mutations with userId
13. Configure webhook URL in Clerk dashboard
14. Test end-to-end

## Environment Variables

```bash
# .env.local (Next.js)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Convex (npx convex env set)
CLERK_WEBHOOK_SECRET=whsec_...
CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev
```

## Dependencies

```bash
pnpm add @clerk/nextjs svix
```
