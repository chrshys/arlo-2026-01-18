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
- Development tooling (ESLint, Prettier, Vitest, Husky)
- Code standards documentation
- **Vercel AI Gateway integration** — token/spend tracking, provider fallbacks
- **Activity dashboard** — settings page with AI usage table (model, tokens, cost)
- **Design system** — shadcn/ui + Tailwind CSS variables + dark/light mode

**Blockers:** None

**Next Priority:** Proactive features (scheduled functions, morning summary, reminders)

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

### 2026-01-16 (continued) — Development Infrastructure Setup

**Focus:** Establish code quality tooling for an AI-written codebase.

**Context:** Codebase will be 100% AI-written, so tooling focuses on consistency across sessions, catching errors automatically, and documenting conventions AI can follow.

**Activities:**

1. Audited existing infrastructure (TypeScript strict mode was already good)
2. Installed and configured Prettier, ESLint, Vitest, Husky, lint-staged
3. Created STANDARDS.md with coding conventions for AI to follow
4. Set up git repo with initial commit

**Files Created/Modified:**

| File                        | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `.prettierrc`               | Formatting rules (no semicolons, single quotes, 100 char width) |
| `.prettierignore`           | Ignore generated/external files                                 |
| `eslint.config.mjs`         | Strict ESLint with TypeScript, React, and React Hooks rules     |
| `vitest.config.ts`          | Test runner config with jsdom, React support                    |
| `vitest.setup.ts`           | Test setup (jest-dom matchers)                                  |
| `.husky/pre-commit`         | Runs lint-staged before each commit                             |
| `STANDARDS.md`              | Code conventions for AI to follow                               |
| `__tests__/example.test.ts` | Sample test to verify setup                                     |
| `package.json`              | Added scripts: check, lint, format, typecheck, test             |

**New Commands:**

```bash
pnpm check          # typecheck + lint + format check
pnpm lint           # ESLint
pnpm format         # Prettier
pnpm typecheck      # TypeScript
pnpm test           # Vitest
```

**Decision:** Skip CI/CD for now (solo developer, checks run locally via git hooks).

**Result:** All checks pass. Initial commit created with 295 files.

---

### 2026-01-16 (continued) — Vercel AI Gateway Migration

**Focus:** Migrate from direct Anthropic API to Vercel AI Gateway for spend tracking and provider flexibility.

**Motivation:** Track token spend in Vercel dashboard, enable future model routing (different agents for different tasks), automatic failover to backup providers.

**Activities:**

1. Researched Vercel AI Gateway documentation
2. Installed `@ai-sdk/gateway` package
3. Updated `convex/arlo/agent.ts` to use gateway provider
4. Upgraded `@convex-dev/agent` from 0.1.x to 0.3.2 (required AI SDK v5)
5. Upgraded `ai` package from v4 to v5
6. Resolved version compatibility issues (gateway v2 for agent v0.3.x compatibility)
7. Tested end-to-end: message → tool call → response

**Package Changes:**

| Package             | Before | After   |
| ------------------- | ------ | ------- |
| `ai`                | 4.3.x  | 5.0.121 |
| `@convex-dev/agent` | 0.1.x  | 0.3.2   |
| `@ai-sdk/gateway`   | —      | 2.0.27  |
| `@ai-sdk/anthropic` | 1.2.x  | removed |

**Code Changes:**

- `convex/arlo/agent.ts`: `anthropic()` → `gateway()`, `chat` → `languageModel`
- Environment: Added `AI_GATEWAY_API_KEY` to Convex

**Result:** Arlo now routes through AI Gateway. Each request logs:

- Cost per request (e.g., `$0.003066`)
- Token breakdown (prompt/completion)
- Provider routing with fallbacks (Anthropic → Vertex → Bedrock)

---

### 2026-01-16 (continued) — Activity Dashboard Design

**Focus:** Design an in-app activity dashboard for tracking AI spend.

**Context:** With AI Gateway integrated, cost data is now available per request. User wants visibility into spend within the app, similar to OpenRouter's activity feed.

**Design Decisions:**

1. **Scope:** Activity table only (no summary charts for MVP)
2. **Location:** New `/settings/activity` page under settings section
3. **Columns:** Timestamp, Model, Thread, Tokens (in→out), Cost
4. **Pagination:** Basic 25/50/100 items (no date filtering for MVP)
5. **Settings structure:** Sidebar layout for future expansion

**Artifacts Created:**

- `docs/plans/2026-01-16-activity-dashboard-design.md` — Full design specification

**Result:** Design approved, ready for implementation.

---

### 2026-01-16 (continued) — Design System Setup

**Focus:** Establish a design system with shadcn/ui, Tailwind CSS variables, and dark/light mode support.

**Motivation:** Build a consistent UI foundation before the codebase grows. Enable dark mode from the start. Use shadcn's component registry to pull components as needed.

**Design Decisions:**

1. **UI library:** shadcn/ui (components copied into codebase, not a dependency)
2. **Color scheme:** shadcn defaults (neutral palette), customize later
3. **Dark mode:** System preference with manual override in settings
4. **Migration approach:** Gradual — existing components updated incrementally

**Activities:**

1. Ran `npx shadcn@latest init` to scaffold config and CSS variables
2. Installed `next-themes` for dark mode handling
3. Created ThemeProvider component wrapping next-themes
4. Added Appearance settings page with theme selector (System/Light/Dark)
5. Migrated all components to use CSS variable-based colors

**Files Created:**

| File                                      | Purpose                          |
| ----------------------------------------- | -------------------------------- |
| `components/providers/theme-provider.tsx` | next-themes wrapper              |
| `app/settings/appearance/page.tsx`        | Theme selector UI                |
| `components/ui/button.tsx`                | shadcn Button component          |
| `components/ui/input.tsx`                 | shadcn Input component           |
| `components/ui/select.tsx`                | shadcn Select component          |
| `components/ui/checkbox.tsx`              | shadcn Checkbox component        |
| `lib/utils.ts`                            | `cn()` utility for class merging |
| `components.json`                         | shadcn configuration             |
| `docs/plans/2025-01-16-design-system.md`  | Design document                  |

**Files Modified:**

| File                             | Changes                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `tailwind.config.ts`             | Added dark mode class strategy, CSS variable colors        |
| `app/globals.css`                | Added CSS custom properties for light/dark themes          |
| `app/layout.tsx`                 | Wrapped with ThemeProvider, added suppressHydrationWarning |
| `app/settings/layout.tsx`        | Added Appearance nav item, migrated to CSS variables       |
| `components/Chat.tsx`            | Migrated to shadcn Button/Input, CSS variable colors       |
| `components/TaskList.tsx`        | Migrated to shadcn Checkbox, CSS variable colors           |
| `components/ActivityTable.tsx`   | Migrated to CSS variable colors                            |
| `app/page.tsx`                   | Migrated to CSS variable colors                            |
| `app/settings/activity/page.tsx` | Migrated to CSS variable colors                            |

**New Packages:**

| Package                    | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `next-themes`              | Dark mode state management                |
| `tailwindcss-animate`      | Animation utilities (shadcn dep)          |
| `class-variance-authority` | Variant management (shadcn dep)           |
| `clsx`                     | Class concatenation (shadcn dep)          |
| `tailwind-merge`           | Tailwind class deduplication (shadcn dep) |
| `@radix-ui/react-checkbox` | Checkbox primitive (shadcn dep)           |
| `@radix-ui/react-select`   | Select primitive (shadcn dep)             |
| `@radix-ui/react-slot`     | Slot primitive (shadcn dep)               |
| `lucide-react`             | Icons (shadcn dep)                        |

**Result:** All UI components now support dark mode. Theme can be toggled at `/settings/appearance`.

---

### 2026-01-16 (continued) — Activity Dashboard Implementation

**Focus:** Implement the activity dashboard design.

**Activities:**

1. Created `convex/usage.ts` with `activityLog` query
2. Built settings layout with sidebar navigation
3. Implemented activity page with pagination selector
4. Created ActivityTable component with formatted columns
5. Added settings link to main header

**Files Created:**

| File                             | Purpose                                    |
| -------------------------------- | ------------------------------------------ |
| `convex/usage.ts`                | Query to aggregate messages with cost data |
| `app/settings/layout.tsx`        | Settings shell with sidebar navigation     |
| `app/settings/page.tsx`          | Redirect to /settings/activity             |
| `app/settings/activity/page.tsx` | Activity page with table and pagination    |
| `components/ActivityTable.tsx`   | Activity table component                   |

**Technical Notes:**

- Activity query iterates through threads to collect messages with usage data
- Filters to assistant messages with `providerMetadata.gateway.cost`
- Sorts by `_creationTime` descending, applies limit
- Table formats: timestamps ("Jan 16, 12:44 PM"), model (strips provider prefix), tokens ("764 → 40"), cost ("$0.0029")

**Result:** Activity dashboard implemented and accessible via Settings link in header.

---

### 2026-01-16 (continued) — Quality Fixes & Logging

**Focus:** Address quality findings and add minimal test coverage.

**Activities:**

1. Tightened task ID validation in Convex mutations
2. Added `activity` table and internal logging mutation
3. Logged Arlo tool actions (create/list/complete)
4. Bounded activity log query to reduce N+1 cost
5. Added user-facing chat error messaging and preserved drafts on failure
6. Added helper tests for Activity table formatting

**Files Created/Modified:**

| File                               | Purpose                                  |
| ---------------------------------- | ---------------------------------------- |
| `convex/activity.ts`               | Activity logging mutation                |
| `convex/schema.ts`                 | Added `activity` table                   |
| `convex/arlo/tools.ts`             | Log Arlo tool actions                    |
| `convex/usage.ts`                  | Bounded activity log query               |
| `convex/tasks.ts`                  | Stronger `taskId` validation             |
| `components/Chat.tsx`              | Inline error feedback + preserved drafts |
| `components/ActivityTable.tsx`     | Exported formatting helpers              |
| `__tests__/activity-table.test.ts` | Added formatting tests                   |

**Result:** Better validation, audit logging for Arlo actions, safer activity query, basic tests.

---

## Key Decisions

| Date       | Decision                              | Rationale                                                                                  |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| 2026-01-16 | Use `@convex-dev/agent` as foundation | Thread model fits shared workspace, human-in-the-loop supported, native Convex integration |
| 2026-01-16 | Adopt Lead Agent patterns             | Tool limits, structured outputs, approval flow pattern                                     |
| 2026-01-16 | Lean into Vercel ecosystem            | AI SDK, excellent tooling, active development                                              |
| 2026-01-16 | No hybrid with Vercel Workflow        | Convex Agent + Workflow components provide all needed capabilities                         |
| 2026-01-16 | Foundation complete                   | Implemented 01-foundation.md plan, first milestone achieved                                |
| 2026-01-16 | Dev tooling for AI-written code       | Prettier, ESLint, Vitest, Husky — consistency across sessions, auto-catch errors           |
| 2026-01-16 | Skip CI/CD for now                    | Solo developer; git hooks sufficient; add CI when collaborating or before production       |
| 2026-01-16 | Migrate to Vercel AI Gateway          | Token/spend tracking, provider fallbacks, future model routing for different agent types   |
| 2026-01-16 | Activity dashboard design             | In-app spend visibility; table-only MVP with settings sidebar for future expansion         |
| 2026-01-16 | Activity dashboard implemented        | Settings section with activity table; iterates threads for MVP (no cross-thread index)     |
| 2026-01-16 | Design system with shadcn/ui          | CSS variable-based theming; dark mode from day one; pull components as needed              |

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

---

### 2026-01-16 (continued) — Multi-Panel Layout Implementation

**Focus:** Implement resizable multi-panel layout (Icon Rail, App Header, List Panel, Focus Panel).

**Branch:** `feature/multi-panel-layout`

**Activities:**

1. Created incremental implementation plan (`docs/plans/2026-01-16-multi-panel-layout-incremental.md`)
2. Installed `react-resizable-panels` (v4.x — significantly different API from v3.x)
3. Implemented Phase 1: Foundation (types, provider, minimal AppShell)
4. Implemented Phase 2: Icon Rail component
5. Implemented Phase 3: App Header with command bar
6. Started Phase 4: Resizable panels — encountered persistent collapse bug

**Files Created:**

| File                                                            | Purpose                                        |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `types/panel-layout.ts`                                         | Panel layout types and defaults                |
| `components/providers/panel-layout-provider.tsx`                | Context provider with localStorage persistence |
| `components/layout/AppShell.tsx`                                | Main layout shell with compound components     |
| `components/layout/IconRail.tsx`                                | Left icon navigation rail                      |
| `components/layout/AppHeader.tsx`                               | Top header with command bar                    |
| `components/layout/DesktopPanelLayout.tsx`                      | Resizable panel container                      |
| `app/test-panels/page.tsx` through `app/test-panels12/page.tsx` | Debug test pages                               |

**Critical Discovery: `react-resizable-panels` v4.x API Changes**

The library completely changed its API from v3 to v4:

| v3.x (shadcn docs)       | v4.x (actual)                                                 |
| ------------------------ | ------------------------------------------------------------- |
| `PanelGroup`             | `Group`                                                       |
| `PanelResizeHandle`      | `Separator`                                                   |
| `direction` prop         | `orientation` prop                                            |
| `onResize(size: number)` | `onResize(size: PanelSize)` with `{ asPercentage, inPixels }` |

**Root Cause: v4 Uses Pixels, Not Percentages**

After extensive debugging (12 test pages), the actual issue was discovered:

**`react-resizable-panels` v4.x uses PIXELS for size values, not percentages.**

| v3.x (shadcn docs)       | v4.x (actual)                  |
| ------------------------ | ------------------------------ |
| `defaultSize={20}` = 20% | `defaultSize={20}` = 20 pixels |
| `minSize={15}` = 15%     | `minSize={200}` = 200 pixels   |
| `maxSize={35}` = 35%     | `maxSize={400}` = 400 pixels   |

The panels weren't "collapsing" — they were rendering correctly at 20 pixels wide.

**Debugging Process:**

1. Initially suspected: React fragments, nested wrappers, flexbox, hydration, maxSize
2. Created 12 test pages systematically isolating variables
3. User discovered the fix when manually setting `defaultSize={200}` and it worked

**Corrected Values:**

```typescript
// DesktopPanelLayout.tsx
<Panel id="list" defaultSize={280} minSize={200} maxSize={400}>
<Panel id="focus" minSize={400}>
```

**Current State:**

- Phase 1-3 complete and working
- Phase 4 now unblocked with correct pixel values
- Continuing with Phase 4-8 of incremental plan

**Lesson Learned:** When a library's major version changes, check if fundamental units changed (percentages → pixels). Systematic testing is valuable, but also pay attention to the actual rendered sizes.

---

### 2026-01-16 (continued) — Panel Resize Bug Fix

**Focus:** Debug and fix resizable panels not responding to drag.

**Symptom:** List panel rendered at correct size but could not be resized by dragging the separator.

**Debugging Process:**

1. Created systematic test cases isolating different variables
2. Tests 1-5 all worked (basic, fragments, nesting, context, full structure)
3. Test 6 (actual DesktopPanelLayout component) failed
4. Test 7 (with `onResize` callback updating state) failed
5. Test 8 (with `onResize` callback only logging) worked

**Root Cause:**

Using `onResize` on Panel components triggered React state updates during drag, which caused re-renders that broke the library's internal drag state management.

```tsx
// BROKEN: State update during drag breaks resize
<Panel onResize={(size) => setListPanelSize(size.inPixels)}>

// FIXED: Update state only when drag ends
<Group onLayoutChanged={(layout) => setListPanelSize(layout.list)}>
```

**Solution:**

Replace `onResize` on individual Panel components with `onLayoutChanged` on the Group component. The `onLayoutChanged` callback only fires when the pointer is released, so state updates don't interfere with active drag operations.

**Files Modified:**

| File                                       | Changes                                                |
| ------------------------------------------ | ------------------------------------------------------ |
| `components/layout/DesktopPanelLayout.tsx` | Replaced Panel `onResize` with Group `onLayoutChanged` |

**Lessons Learned:**

1. `react-resizable-panels` v4: Don't update React state in `onResize` callbacks
2. Use `onLayoutChanged` on Group for persisting sizes (fires only on drag end)
3. Systematic test isolation is effective for narrowing down root causes

---

### 2026-01-16 (continued) — Header Layout & Panel Toggle UI

**Focus:** Improve header layout and add visual panel toggle controls.

**Changes:**

1. **Panel toggle buttons in header** — Added PanelLeft/PanelRight icons to toggle list and canvas panels, with visual indicator (muted background) when active
2. **Settings moved to sidebar** — Removed settings icon from header, wired up existing IconRail settings button to `/settings`
3. **Centered search bar** — Restructured header into three-column layout:
   - Left: App name (fixed min-width)
   - Center: Command-K search bar (centered, flexible)
   - Right: Panel toggle buttons (right-aligned, matching min-width)
4. **Removed focus ring on separators** — Added `outline-none` to resize handles

**Files Modified:**

| File                                       | Changes                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `components/layout/AppHeader.tsx`          | Three-column layout, panel toggles, removed settings |
| `components/layout/IconRail.tsx`           | Wired settings button to `/settings` route           |
| `components/layout/DesktopPanelLayout.tsx` | Added `outline-none` to Separator components         |

**Keyboard Shortcuts:**

- `⌘B` — Toggle list panel (left)
- `⌘\` — Toggle canvas panel (right)
