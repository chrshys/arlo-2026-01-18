# CLAUDE.md - Instructions for Claude Code

This file provides guidance for Claude Code when working in this repository.

## Project Overview

**Arlo** is a personal AI assistant with a shared task/notes workspace. The user and AI both read and write to the same data—creating tasks, completing tasks, surfacing information proactively.

**Current state:** Early MVP. Building the foundation with Convex + Next.js.

**Goal:** Validate that a proactive AI assistant sharing your task list makes life better.

## Key Documentation

Read these first when starting work:

- `docs/specs/PRODUCT-SPEC.md` — Full product specification (MVP + long-term vision)
- `docs/specs/arlo-behavioral-spec.md` — How Arlo behaves as an agent
- `docs/specs/task-vault-behavioral-spec.md` — Task/notes app behavior
- `docs/plans/` — Implementation plans (start with `01-foundation.md`)
- `STANDARDS.md` — **Code conventions (follow these when writing code)**
- `RESEARCH.md` — Technical research and findings (Vercel ecosystem, Convex Agent, etc.)
- `HISTORY.md` — Session summaries, key decisions, and artifacts created

## Architecture

```
┌─────────────────────────────────────────┐
│              CONVEX                     │
│  Database + Scheduled Functions +       │
│  Arlo Agent (runs as actions)           │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
   Next.js (Vercel)    Telegram Bot
   Chat UI             (future)
```

- **Convex** is the backend (database, cron, agent execution)
- **Next.js** is the frontend (chat UI, task list)
- **Arlo** runs as Convex actions (serverless)

## Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Database   | Convex                               |
| Frontend   | Next.js + React                      |
| AI SDK     | Vercel AI SDK (`ai` package)         |
| LLM        | Claude (Anthropic)                   |
| Styling    | Tailwind CSS                         |
| Deployment | Vercel (frontend) + Convex (backend) |

## Directory Structure

```
/
├── CLAUDE.md              # You are here
├── AGENTS.md              # General AI assistant guidance
├── RESEARCH.md            # Technical research and findings
├── HISTORY.md             # Session history and decisions
├── docs/plans/            # Implementation plans
├── convex/                # Convex backend
│   ├── schema.ts          # Database schema
│   ├── tasks.ts           # Task mutations/queries
│   ├── notes.ts           # Note mutations/queries
│   ├── messages.ts        # Chat message handling
│   └── arlo/              # Arlo agent logic
│       ├── agent.ts       # Main agent action
│       ├── tools.ts       # Tool definitions
│       └── scheduler.ts   # Scheduled jobs
├── app/                   # Next.js app router
│   ├── page.tsx           # Main chat/task UI
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Shared utilities
├── docs/
│   └── specs/             # Product specifications
└── package.json
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development (Convex + Next.js)
pnpm dev

# Run Convex separately
npx convex dev

# Code quality (run before committing)
pnpm check          # typecheck + lint + format check
pnpm lint           # ESLint
pnpm lint:fix       # ESLint with auto-fix
pnpm format         # Prettier (write)
pnpm format:check   # Prettier (check only)
pnpm typecheck      # TypeScript type checking

# Testing
pnpm test           # Vitest in watch mode
pnpm test:run       # Vitest single run
pnpm test:coverage  # Vitest with coverage

# Deploy
pnpm build
npx convex deploy
```

## Convex Patterns

### Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    status: v.union(v.literal('pending'), v.literal('completed')),
    // ... see PRODUCT-SPEC.md for full schema
  }).index('by_status', ['status']),
})
```

### Queries and Mutations

```typescript
// convex/tasks.ts
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Query implementation
  },
})

export const create = mutation({
  args: { title: v.string() /* ... */ },
  handler: async (ctx, args) => {
    // Mutation implementation
  },
})
```

### Actions (for AI/external APIs)

```typescript
// convex/arlo/agent.ts
import { action } from '../_generated/server'
import { v } from 'convex/values'

export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    // Call Claude API
    // Execute tools via ctx.runMutation
    // Return response
  },
})
```

### Scheduled Functions

```typescript
// convex/arlo/scheduler.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.daily(
  'morning-summary',
  { hourUTC: 12, minuteUTC: 0 }, // 8am ET
  internal.arlo.scheduler.morningSummary
)

export default crons
```

## Arlo Agent Guidelines

When implementing Arlo:

1. **Tools over raw output** — Arlo should use tools (createTask, completeTask, etc.) rather than just describing what to do

2. **Context injection** — Before each response, inject:
   - User instructions (from `instructions` table)
   - Recent activity
   - Relevant tasks (due soon, assigned to Arlo)

3. **Activity logging** — Log every action Arlo takes to the `activity` table

4. **Source tracking** — When Arlo creates tasks from external sources, set the `source` field

5. **Confirmation for external actions** — Arlo should ask before sending emails, creating calendar events, etc.

## Common Tasks

### Adding a New Tool

1. Define the tool in `convex/arlo/tools.ts`
2. Implement the handler (usually calls a mutation)
3. Add to tools array passed to Claude
4. Update system prompt if needed

### Adding an Integration

1. Add OAuth flow (settings page)
2. Store credentials in `integrations` table
3. Create Convex functions to interact with the API
4. Add tools for Arlo to use the integration
5. (Optional) Add scheduled job for proactive ingestion

### Adding a Scheduled Job

1. Define internal function in `convex/arlo/scheduler.ts`
2. Register with `cronJobs()`
3. Implement the job logic
4. Log activity on completion

## Code Style

- Use TypeScript strictly (no `any` without good reason)
- Prefer Convex idioms (queries, mutations, actions)
- Keep components small and focused
- Use Tailwind for styling
- Write self-documenting code; add comments for "why" not "what"

## Testing

```bash
# Run tests
pnpm test

# Test Convex functions locally
# Use Convex dashboard for quick iteration
```

## Environment Variables

```bash
# .env.local
CONVEX_DEPLOYMENT=your-deployment
ANTHROPIC_API_KEY=sk-ant-...
# Add integration keys as needed
```

## Questions?

If unclear on architecture or approach, check:

1. `docs/specs/PRODUCT-SPEC.md` — The source of truth
2. `RESEARCH.md` — Technical research and ecosystem findings
3. `HISTORY.md` — Past decisions and their rationale
4. Convex docs — https://docs.convex.dev
5. Vercel AI SDK — https://sdk.vercel.ai

When in doubt, keep it simple. MVP first, polish later.

## Session Workflow

At the end of significant sessions:

1. Update `RESEARCH.md` with any new technical findings
2. Update `HISTORY.md` with session summary, decisions made, and artifacts created
3. This ensures continuity across sessions and preserves reasoning
