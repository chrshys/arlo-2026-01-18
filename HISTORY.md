# HISTORY.md - Session History & Decisions

This file captures summaries of development sessions, key decisions made, and artifacts created. Reference this to understand project evolution and past reasoning.

---

## Current State

**Phase:** Foundation complete, ready for Proactive phase

**Implemented:**

- Full chat UI with Arlo
- Task creation/completion via chat
- Task list with real-time updates
- Mobile-responsive layout

**Blockers:** None

**Next Priority:** Proactive features — scheduled functions, morning summary, reminders

### What Exists

- Working Next.js + Convex application
- Arlo agent with tools: `createTask`, `listTasks`, `completeTask`
- Chat UI with message threading
- Task list sidebar with completion checkboxes
- Documentation (specs, research, this file)

### What to Build Next

**Week 2: Proactive** (from PRODUCT-SPEC.md)

- Scheduled functions in Convex (cron)
- Morning summary: "Here's what's due today"
- Reminder notifications when tasks are due
- (Optional) Telegram bot for native push notifications

**Milestone achieved:** "I can chat with Arlo on my phone, ask it to create a task, and see the task persist." ✓

---

## Session Log

### 2026-01-16 — Initial Research Session

**Focus:** Understanding the project vision and researching the Vercel ecosystem for useful tools.

**Activities:**

1. Reviewed PRODUCT-SPEC.md to understand the full vision
2. Researched Vercel GitHub orgs (vercel, vercel-labs) for relevant projects
3. Deep dive into Convex Agent Component architecture
4. Compared Convex Agent vs Vercel Workflow/Lead Agent patterns

**Key Findings:**

1. **Convex Agent Component** (`@convex-dev/agent`) — Purpose-built for our use case
   - Thread model matches "shared workspace" concept
   - Automatic context injection with hybrid search
   - Native Convex integration

2. **Lead Agent** — Reference architecture with patterns to adopt
   - Human-in-the-loop approval gates (Slack)
   - 20-step tool limits for cost control
   - `generateObject` for structured outputs
   - Immediate response + background processing

3. **Vercel Workflow** — Worth evaluating if Convex workflows lack human-in-the-loop

**Artifacts Created:**

- `RESEARCH.md` — Technical research documentation
- `HISTORY.md` — This file

**Next Steps:**

- ~~Clone and explore Convex agent example repo~~ ✓
- ~~Test workflow capabilities (human-in-the-loop, suspension/resumption)~~ ✓
- ~~Decide on final architecture approach~~ ✓
- Begin implementation with `@convex-dev/agent`

---

### 2026-01-16 (continued) — Deep Dive into Convex Agent

**Focus:** Explored Convex Agent component source code and documentation to answer key architecture questions.

**Activities:**

1. Cloned `https://github.com/get-convex/agent` for source exploration
2. Read docs: workflows.mdx, human-agents.mdx, agent-usage.mdx, threads.mdx, tools.mdx
3. Studied example implementations: chat/basic.ts, chat/human.ts, workflows/chaining.ts

**Key Findings:**

1. **Human-in-the-loop is supported** via tool calls without handlers:
   - LLM calls a tool (e.g., `askHuman`) that has no execute function
   - We intercept, save approval request, wait for human
   - Human responds → save as tool result → resume generation
   - Perfect for Arlo's "ask before sending email" pattern

2. **Durable workflows via `@convex-dev/workflow`:**
   - Each step is idempotent and recorded
   - Survives server restarts
   - Configurable retries per step
   - Can span much longer than 5-min action limit

3. **Recommended chat pattern:** Mutation + Async Action
   - Mutation saves message (transactional, optimistic UI)
   - Schedules action to generate response
   - Clients auto-update via subscriptions

4. **Tool limits built-in:** `stopWhen: stepCountIs(N)` prevents runaway costs

**Resolved Questions:**

- Human-in-the-loop: **Yes**, via tool call pattern
- Workflow suspension: **Yes**, via `@convex-dev/workflow`
- Hybrid with Vercel Workflow: **Not needed**

**Decision:** Use `@convex-dev/agent` as the foundation for Arlo. It has everything we need.

---

### 2026-01-16 (continued) — Foundation Implementation

**Focus:** Implemented the complete foundation plan, achieving first milestone.

**Activities:**

1. Scaffolded project (package.json, tsconfig, Next.js config, Tailwind)
2. Configured Convex with `@convex-dev/agent` component
3. Created Arlo agent with tools: `createTask`, `listTasks`, `completeTask`
4. Implemented chat backend (threads, messages, response generation)
5. Built Chat and TaskList UI components
6. Fixed API mismatches (plan referenced `listUIMessages` but actual export is `listMessages`)
7. Fixed message ordering (reversed to show oldest-first)

**Files Created:**
| File | Purpose |
|------|---------|
| `convex/convex.config.ts` | Agent component configuration |
| `convex/schema.ts` | Tasks table schema |
| `convex/arlo/agent.ts` | Arlo agent definition |
| `convex/arlo/tools.ts` | Tool definitions (createTask, listTasks, completeTask) |
| `convex/tasks.ts` | Task CRUD mutations/queries |
| `convex/chat.ts` | Message send + response generation |
| `convex/threads.ts` | Thread creation + message listing |
| `components/ConvexProvider.tsx` | Convex React provider |
| `components/Chat.tsx` | Chat UI component |
| `components/TaskList.tsx` | Task list with checkboxes |
| `app/layout.tsx` | Root layout with provider |
| `app/page.tsx` | Main page (chat + task panel) |

**Issues Resolved:**

- `@convex-dev/agent` exports `listMessages`, not `listUIMessages` (plan was outdated)
- Message doc structure: uses `msg.message?.role` and `msg.text`, not `msg.role`/`msg.content`
- Messages returned newest-first; added `.reverse()` for proper chat ordering

**Result:** First milestone achieved — can chat with Arlo, create tasks, see them persist.

---

## Key Decisions

| Date       | Decision                              | Rationale                                                                                  |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| 2026-01-16 | Use `@convex-dev/agent` as foundation | Thread model fits shared workspace, human-in-the-loop supported, native Convex integration |
| 2026-01-16 | Adopt Lead Agent patterns             | Tool limits, structured outputs, approval flow pattern                                     |
| 2026-01-16 | Lean into Vercel ecosystem            | AI SDK, excellent tooling, active development                                              |
| 2026-01-16 | No hybrid with Vercel Workflow        | Convex Agent + Workflow components provide all needed capabilities                         |
| 2026-01-16 | Foundation complete                   | Implemented 01-foundation.md plan, first milestone achieved                                |

---

## Architecture Evolution

### Current State (2026-01-16)

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

### Planned Evolution

**Decision: Use `@convex-dev/agent`** for:

- Thread-based message persistence
- Automatic context injection with vector search
- Human-in-the-loop via tool call pattern
- Multi-agent support (future)

**Additional components:**

- `@convex-dev/workflow` — for durable multi-step operations (email scanning, etc.)
- Vercel AI SDK — already in stack, provider-agnostic LLM calls

---

## Glossary

Terms and concepts established during development:

| Term                  | Definition                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| **Thread**            | Persistent message container in Convex Agent; shareable across agents/users |
| **Human-in-the-loop** | Pattern where workflow pauses for human approval before external actions    |
| **Tool limits**       | Max steps (e.g., 20) to prevent runaway agent execution and costs           |
