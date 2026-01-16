# Foundation Implementation Plan

**Goal:** "I can chat with Arlo on my phone, ask it to create a task, and see the task persist."

**Estimated scope:** ~5 files, ~500 lines of code

---

## Phase 1: Backend Setup

### 1.1 Install Dependencies

```bash
npm install @convex-dev/agent @ai-sdk/anthropic ai zod
```

### 1.2 Configure Convex Component

Create `convex/convex.config.ts`:

```typescript
import { defineApp } from 'convex/server'
import agent from '@convex-dev/agent/convex.config'

const app = defineApp()
app.use(agent)
export default app
```

### 1.3 Define Schema

Create/update `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    status: v.union(v.literal('pending'), v.literal('completed')),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index('by_status', ['status']),
})
```

---

## Phase 2: Arlo Agent

### 2.1 Create Agent Definition

Create `convex/arlo/agent.ts`:

```typescript
import { Agent, createTool } from '@convex-dev/agent'
import { anthropic } from '@ai-sdk/anthropic'
import { components } from '../_generated/api'
import { z } from 'zod'

export const arlo = new Agent(components.agent, {
  name: 'Arlo',
  languageModel: anthropic('claude-sonnet-4-20250514'),
  instructions: `You are Arlo, a personal assistant who shares a task workspace with the user.

You can create tasks, list tasks, and complete tasks. Be concise and helpful.
When the user asks you to do something that requires a task, create one.
When listing tasks, format them clearly.`,
  tools: {
    createTask,
    listTasks,
    completeTask,
  },
  maxSteps: 5,
})
```

### 2.2 Define Tools

Create `convex/arlo/tools.ts`:

```typescript
import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../_generated/api'

export const createTask = createTool({
  description: 'Create a new task',
  args: z.object({
    title: z.string().describe('The task title'),
  }),
  handler: async (ctx, args): Promise<{ taskId: string; message: string }> => {
    const taskId = await ctx.runMutation(internal.tasks.create, {
      title: args.title,
      createdBy: 'arlo',
    })
    return { taskId, message: `Created task: ${args.title}` }
  },
})

export const listTasks = createTool({
  description: 'List all pending tasks',
  args: z.object({}),
  handler: async (ctx): Promise<{ tasks: Array<{ id: string; title: string }> }> => {
    const tasks = await ctx.runQuery(internal.tasks.listPending)
    return { tasks: tasks.map((t) => ({ id: t._id, title: t.title })) }
  },
})

export const completeTask = createTool({
  description: 'Mark a task as completed',
  args: z.object({
    taskId: z.string().describe('The ID of the task to complete'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    await ctx.runMutation(internal.tasks.complete, { taskId: args.taskId })
    return { message: 'Task completed' }
  },
})
```

### 2.3 Task Mutations/Queries

Create `convex/tasks.ts`:

```typescript
import { mutation, query, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

export const create = internalMutation({
  args: { title: v.string(), createdBy: v.union(v.literal('user'), v.literal('arlo')) },
  handler: async (ctx, args) => {
    return await ctx.db.insert('tasks', {
      title: args.title,
      status: 'pending',
      createdBy: args.createdBy,
      createdAt: Date.now(),
    })
  },
})

export const listPending = internalQuery({
  handler: async (ctx) => {
    return await ctx.db
      .query('tasks')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect()
  },
})

export const complete = internalMutation({
  args: { taskId: v.string() },
  handler: async (ctx, { taskId }) => {
    await ctx.db.patch(taskId as any, {
      status: 'completed',
      completedAt: Date.now(),
    })
  },
})

// Public query for UI
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('tasks').collect()
  },
})
```

---

## Phase 3: Chat Backend

### 3.1 Chat Actions

Create `convex/chat.ts`:

```typescript
import { mutation, internalAction } from './_generated/server'
import { v } from 'convex/values'
import { saveMessage } from '@convex-dev/agent'
import { components, internal } from './_generated/api'
import { arlo } from './arlo/agent'

// User sends a message
export const send = mutation({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    })
    await ctx.scheduler.runAfter(0, internal.chat.generateResponse, {
      threadId,
      promptMessageId: messageId,
    })
    return messageId
  },
})

// Arlo generates a response
export const generateResponse = internalAction({
  args: { threadId: v.string(), promptMessageId: v.string() },
  handler: async (ctx, { threadId, promptMessageId }) => {
    await arlo.generateText(ctx, { threadId }, { promptMessageId })
  },
})
```

### 3.2 Thread Management

Create `convex/threads.ts`:

```typescript
import { mutation, query } from './_generated/server'
import { createThread, listUIMessages } from '@convex-dev/agent'
import { components } from './_generated/api'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

export const create = mutation({
  handler: async (ctx) => {
    return await createThread(ctx, components.agent, {
      title: 'Chat with Arlo',
    })
  },
})

export const messages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { threadId, paginationOpts }) => {
    return await listUIMessages(ctx, components.agent, {
      threadId,
      paginationOpts,
    })
  },
})
```

---

## Phase 4: Minimal UI

### 4.1 Chat Component

Create `components/Chat.tsx`:

- Text input at bottom
- Messages list (scrollable)
- Show user messages right-aligned, Arlo left-aligned
- Loading state while Arlo responds

### 4.2 Task List Component

Create `components/TaskList.tsx`:

- List pending tasks
- Checkbox to complete (calls mutation directly, not through Arlo)
- Real-time updates via Convex subscription

### 4.3 Main Page

Update `app/page.tsx`:

- Mobile-first layout
- Chat takes most of screen
- Task list collapsible or in sidebar on desktop

---

## Phase 5: Wire & Test

### Test Cases

1. **Create task via chat:**
   - Send: "Add a task to buy groceries"
   - Expect: Task appears in task list

2. **List tasks via chat:**
   - Send: "What's on my list?"
   - Expect: Arlo responds with task titles

3. **Complete task via chat:**
   - Send: "Mark the groceries task as done"
   - Expect: Task disappears from pending list

4. **Complete task via UI:**
   - Click checkbox on task
   - Expect: Task completes, real-time update

---

## Files to Create

| File                      | Purpose                   |
| ------------------------- | ------------------------- |
| `convex/convex.config.ts` | Configure agent component |
| `convex/schema.ts`        | Database schema           |
| `convex/arlo/agent.ts`    | Arlo agent definition     |
| `convex/arlo/tools.ts`    | Tool definitions          |
| `convex/tasks.ts`         | Task CRUD operations      |
| `convex/chat.ts`          | Chat send/receive         |
| `convex/threads.ts`       | Thread management         |
| `components/Chat.tsx`     | Chat UI                   |
| `components/TaskList.tsx` | Task list UI              |
| `app/page.tsx`            | Main page (update)        |

---

## Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Success Criteria

- [ ] Can send message to Arlo and receive response
- [ ] "Create a task to X" creates a task
- [ ] "What are my tasks?" lists tasks
- [ ] "Complete X" marks task done
- [ ] Task list updates in real-time
- [ ] Works on mobile browser
