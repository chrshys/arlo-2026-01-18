# AGENTS.md - AI Coding Assistant Guide

Instructions for AI coding assistants (Claude Code, Codex, Cursor, etc.) working in this repository.

---

## Quick Context

**Project:** Arlo — A personal AI assistant with a shared task/notes workspace

**What it does:**

- User and AI share the same task list
- AI can create tasks, complete tasks, surface information proactively
- Integrates with Gmail, Calendar, Slack (eventually)

**Current phase:** MVP — Convex backend + Next.js chat UI

**Stack:** Convex, Next.js, React, Vercel AI SDK, Claude API, Tailwind

---

## Before You Start

### Read These Files

| File                                       | Purpose                                                   |
| ------------------------------------------ | --------------------------------------------------------- |
| `docs/specs/PRODUCT-SPEC.md`               | Full product spec (MVP + vision)                          |
| `docs/specs/arlo-behavioral-spec.md`       | How Arlo behaves                                          |
| `docs/specs/task-vault-behavioral-spec.md` | Task app behavior                                         |
| `CLAUDE.md`                                | Technical patterns and conventions                        |
| `RESEARCH.md`                              | Technical research (Vercel ecosystem, Convex Agent, etc.) |
| `HISTORY.md`                               | Session history, decisions, and artifacts                 |

### Understand the Architecture

```
Convex (backend)
├── Database (tasks, notes, messages, etc.)
├── Scheduled functions (cron jobs)
└── Actions (Arlo agent runs here)
        │
        ▼
Next.js on Vercel (frontend)
├── Chat UI
├── Task list
└── Settings
```

**Key insight:** Arlo runs as Convex actions, not a separate server. When a user sends a message, a Convex action calls Claude, executes tools, writes to the database.

---

## Core Principles

### 1. MVP First

We're validating value, not building a polished product. Prefer:

- Working over perfect
- Simple over clever
- Fewer features done well over many features half-done

### 2. Convex is the Backend

Everything goes through Convex:

- Database operations → queries and mutations
- AI/external API calls → actions
- Scheduled work → cron jobs

Don't add separate backend services unless absolutely necessary.

### 3. Arlo is a Peer

Arlo isn't a feature bolted onto a task app. Arlo is a peer who shares the workspace:

- Same data access as user
- Can create tasks, complete tasks, add notes
- Tasks have `createdBy: "user" | "arlo"` to track origin

### 4. Proactive > Reactive

The core value is Arlo doing things without being asked:

- Morning summaries
- Action items from email
- Reminders before deadlines
- Surfacing relevant context

Build scheduled jobs and triggers, not just chat responses.

---

## Technical Patterns

### Convex Schema

Full schema is in `docs/specs/PRODUCT-SPEC.md`. Key tables:

```typescript
tasks: { title, body, status, assignee, due, createdBy, source, ... }
notes: { title, body, projectId, taskId, createdBy, ... }
messages: { role, content, createdAt }
instructions: { content, category }  // Arlo's memory
activity: { trigger, action, outcome, timestamp }  // Audit log
```

### Arlo Agent Pattern

```typescript
// convex/arlo/agent.ts
export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    // 1. Load context
    const instructions = await ctx.runQuery(internal.instructions.list);
    const recentTasks = await ctx.runQuery(internal.tasks.listRecent);

    // 2. Build prompt
    const systemPrompt = buildSystemPrompt(instructions, recentTasks);

    // 3. Call Claude with tools
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      system: systemPrompt,
      messages: [...history, { role: "user", content: args.message }],
      tools: ARLO_TOOLS,
    });

    // 4. Execute tool calls
    for (const toolCall of response.tool_calls) {
      await executeToolCall(ctx, toolCall);
    }

    // 5. Log activity
    await ctx.runMutation(internal.activity.log, { ... });

    // 6. Return response
    return response.content;
  },
});
```

### Tool Implementation

Tools are how Arlo takes action. Each tool:

1. Has a clear description for the LLM
2. Maps to a Convex mutation or query
3. Returns a result the LLM can use

```typescript
const tools = [
  {
    name: 'createTask',
    description: 'Create a new task in the workspace',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        due: { type: 'number', description: 'Due date (unix timestamp)' },
        assignee: { type: 'string', enum: ['user', 'arlo'] },
      },
      required: ['title'],
    },
  },
  // ... more tools
]

async function executeToolCall(ctx, toolCall) {
  switch (toolCall.name) {
    case 'createTask':
      return await ctx.runMutation(internal.tasks.create, {
        ...toolCall.input,
        createdBy: 'arlo',
      })
    // ... more cases
  }
}
```

### Scheduled Jobs

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server'

const crons = cronJobs()

// Morning summary at 8am ET (12:00 UTC in winter, 13:00 UTC in summer)
crons.daily(
  'morning-summary',
  { hourUTC: 13, minuteUTC: 0 },
  internal.arlo.scheduler.morningSummary
)

// Check for due tasks every hour
crons.hourly('check-reminders', { minuteUTC: 0 }, internal.arlo.scheduler.checkReminders)

export default crons
```

---

## Common Tasks

### "Add a new feature to Arlo"

1. Do I need a new tool? → Add to `convex/arlo/tools.ts`
2. Do I need new data? → Update `convex/schema.ts`
3. Do I need a scheduled job? → Add to `convex/crons.ts`
4. Do I need UI? → Add to `app/` or `components/`

### "Integrate a new service (Gmail, Slack, etc.)"

1. Add OAuth flow in settings UI
2. Store credentials in `integrations` table (encrypted)
3. Create Convex actions to call the API
4. Add tools for Arlo to use
5. (Optional) Add scheduled ingestion job

### "Fix a bug in Arlo's behavior"

1. Check the system prompt in `convex/arlo/agent.ts`
2. Check tool descriptions — LLM uses these to decide what to call
3. Check activity logs for what actually happened
4. Add explicit instructions if Arlo keeps making the same mistake

### "Improve the UI"

1. Keep it simple — this is MVP
2. Mobile-first (must work on phone)
3. Use Tailwind, match existing patterns
4. Don't over-engineer; we might throw it away

---

## Don'ts

❌ **Don't add a separate backend** — Use Convex for everything

❌ **Don't build features not in the spec** — Check PRODUCT-SPEC.md first

❌ **Don't optimize prematurely** — Working > Fast > Perfect

❌ **Don't skip activity logging** — We need to see what Arlo does

❌ **Don't let Arlo take external actions without confirmation** — Trust is earned

❌ **Don't store secrets in code** — Use environment variables

---

## Do's

✅ **Do read the specs first** — They exist for a reason

✅ **Do keep it simple** — MVP mindset

✅ **Do log everything Arlo does** — Activity table is the audit trail

✅ **Do write TypeScript strictly** — Convex is type-safe, use it

✅ **Do test on mobile** — It's a primary use case

✅ **Do ask if unclear** — Better to clarify than build the wrong thing

---

## Environment Setup

```bash
# Clone and install
git clone <repo>
cd task-vault
pnpm install

# Set up environment
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY, CONVEX_DEPLOYMENT

# Start development
pnpm dev
```

---

## Resources

- [Convex Docs](https://docs.convex.dev)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Anthropic API](https://docs.anthropic.com)
- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## Questions?

If you're unsure about something:

1. Check `docs/specs/PRODUCT-SPEC.md` — it's the source of truth
2. Check `RESEARCH.md` — technical research and ecosystem findings
3. Check `HISTORY.md` — past decisions and their rationale
4. Check `CLAUDE.md` — technical patterns
5. Look at existing code — follow the patterns
6. When in doubt, keep it simple and ask

The goal is a working MVP that validates value. Ship fast, learn fast.

---

## Session Workflow

At the end of significant development sessions:

1. **Update `RESEARCH.md`** with any new technical findings:
   - New libraries or tools discovered
   - Architecture patterns researched
   - Comparisons and trade-offs analyzed

2. **Update `HISTORY.md`** with session summary:
   - What was worked on
   - Key decisions made and their rationale
   - Artifacts created (files, features, etc.)
   - Next steps identified

This ensures continuity across sessions and preserves context for future work.
