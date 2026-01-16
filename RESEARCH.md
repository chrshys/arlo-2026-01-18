# RESEARCH.md - Technical Research & Findings

This file captures research conducted during development sessions. Reference this when building features or making architectural decisions.

---

## Table of Contents

1. [Vercel Ecosystem](#vercel-ecosystem)
2. [Convex Agent Component](#convex-agent-component)
3. [Architecture Patterns](#architecture-patterns)
4. [Open Questions](#open-questions)

---

## Vercel Ecosystem

_Research Date: 2026-01-16_

### Critical Projects for Arlo

#### 1. AI SDK (20.9k stars)

**Repo:** https://github.com/vercel/ai

Provider-agnostic TypeScript toolkit for AI apps. Already in our stack.

**Key capabilities:**

- `generateText()` — text generation with streaming
- `generateObject()` — structured outputs with Zod validation
- `ToolLoopAgent` — multi-step agent reasoning
- Provider-agnostic (Claude, GPT, Gemini swappable)

**Relevant examples:**

- `next-agent` — agent architecture patterns
- `next-openai` — chat UI patterns
- `mcp` — Model Context Protocol integration

#### 2. Vercel Workflow (1.6k stars)

**Repo:** https://github.com/vercel/workflow
**Docs:** https://useworkflow.dev

Durable execution framework. Potential complement to Convex scheduler.

**Key capabilities:**

- Durable execution (pause/resume preserving state)
- `sleep()` for scheduling without resource consumption
- Human-in-the-loop approval gates
- `@workflow/ai` module for agent workflows

**Trade-off vs Convex:** Beta (4.0.1), but has explicit human-in-the-loop support that Convex scheduler may lack.

#### 3. Lead Agent — Reference Architecture

**Repo:** https://github.com/vercel-labs/lead-agent

Inbound lead qualification system. Directly applicable patterns for Arlo.

**Architecture flow:**

```
Form Submit → Immediate Response
     ↓
Workflow (durable, background)
     ↓
┌─────────────────────────────────┐
│ stepResearch(data)              │  ← AI Agent with tools
│ stepQualify(data, research)     │  ← generateObject (structured)
│ if QUALIFIED or FOLLOW_UP:      │
│   stepWriteEmail(...)           │  ← generateText
│   stepHumanFeedback(...)        │  ← Slack approval gate
└─────────────────────────────────┘
```

**Patterns to steal:**

1. **Research agent with tool limits** — 20-step max to prevent runaway costs
2. **Structured qualification** — `generateObject` with Zod schemas for categorization
3. **Human-in-the-loop** — Slack approval gates before external actions
4. **Immediate response + background processing** — Acknowledge fast, process async

### Secondary Projects

| Project            | Stars | Relevance                                       |
| ------------------ | ----- | ----------------------------------------------- |
| **Gemini Chatbot** | 1.3k  | Chat UI template (RSC, streaming, file uploads) |
| **Agent Skills**   | 8k    | Modular skill pattern for extensibility         |
| **json-render**    | 4.8k  | AI → structured JSON → React components         |
| **SWR**            | —     | Frontend data fetching with smart caching       |

### Auth Recommendation

**Clerk** over NextAuth for modern UX (social login, MFA, profile management).

---

## Convex Agent Component

_Research Date: 2026-01-16_
_Updated: Deep dive into source code_

**Package:** `@convex-dev/agent`
**Docs:** https://docs.convex.dev/agents
**Repo:** https://github.com/get-convex/agent

### Core Concepts

**Agents** = LLM + prompts + tools, tied to Convex backend

**Threads** = Persistent message containers, shareable across users and agents (including human participants)

### Key Features

| Feature                 | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| **Thread persistence**  | Messages stored, shareable across agents/users           |
| **Automatic context**   | Conversation history auto-injected into LLM calls        |
| **Hybrid search**       | Vector + text search for message history                 |
| **Websocket streaming** | Delta-based, not HTTP streaming                          |
| **RAG integration**     | Built-in or via dedicated component                      |
| **Workflows**           | Multi-step durable operations via `@convex-dev/workflow` |
| **File handling**       | Auto storage with reference counting                     |
| **Rate limiting**       | Built-in via Rate Limiter Component                      |
| **Usage tracking**      | Attribution by provider, model, user, agent              |

### Agent Definition Pattern

```typescript
import { Agent } from '@convex-dev/agent'
import { anthropic } from '@ai-sdk/anthropic'

const arloAgent = new Agent(components.agent, {
  name: 'Arlo',
  instructions: 'You are a helpful personal assistant...',
  languageModel: anthropic('claude-sonnet-4-20250514'),
  textEmbeddingModel: openai.embedding('text-embedding-3-small'), // for RAG
  tools: { createTask, completeTask, searchEmails },
  stopWhen: stepCountIs(10), // Tool call limit
  callSettings: { temperature: 1.0, maxRetries: 3 },
})
```

### Chat Pattern (Recommended)

**Mutation + Async Action** for optimistic UI updates:

```typescript
// Step 1: Save message in mutation (transactional, optimistic)
export const sendMessage = mutation({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    })
    // Kick off async response
    await ctx.scheduler.runAfter(0, internal.arlo.generateResponse, {
      threadId,
      promptMessageId: messageId,
    })
  },
})

// Step 2: Generate response asynchronously
export const generateResponse = internalAction({
  args: { promptMessageId: v.string(), threadId: v.string() },
  handler: async (ctx, { promptMessageId, threadId }) => {
    await arloAgent.generateText(ctx, { threadId }, { promptMessageId })
    // Messages auto-saved, clients auto-updated via subscription
  },
})
```

### Human-in-the-Loop Pattern

**Convex Agent supports human-in-the-loop via two patterns:**

#### Pattern 1: Human as Assistant

Save human responses directly as assistant messages:

```typescript
await saveMessage(ctx, components.agent, {
  threadId,
  agentName: 'Human Support',
  message: { role: 'assistant', content: 'The human reply' },
})
```

#### Pattern 2: Human Response as Tool Call (Recommended for Arlo)

LLM calls a tool without handler, workflow pauses, human responds, workflow resumes:

```typescript
// Define tool without execute handler
const askHuman = tool({
  description: 'Ask user for approval before sending email',
  inputSchema: z.object({
    action: z.string().describe('What action needs approval'),
  }),
})

// Agent generates, hits tool call, we intercept
const result = await agent.generateText(
  ctx,
  { threadId },
  {
    prompt: 'Send email to boss about vacation',
    tools: { askHuman },
  }
)

// Check for approval requests
const approvalRequests = result.toolCalls
  .filter((tc) => tc.toolName === 'askHuman')
  .map(({ toolCallId, input }) => ({ toolCallId, ...input }))

if (approvalRequests.length > 0) {
  // Save to DB, notify user, wait for response
  await ctx.runMutation(internal.approvals.create, { approvalRequests })
}

// Later, when user approves:
await agent.saveMessage(ctx, {
  threadId,
  message: {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        result: 'Approved',
        toolCallId: approvalRequest.toolCallId,
        toolName: 'askHuman',
      },
    ],
  },
})

// Resume generation
await agent.generateText(ctx, { threadId }, { promptMessageId })
```

### Workflow Pattern (Durable Multi-Step)

Uses `@convex-dev/workflow` for durable execution:

```typescript
const workflow = new WorkflowManager(components.workflow)

export const emailScanWorkflow = workflow.define({
  args: { userId: v.string() },
  handler: async (step, { userId }) => {
    // Step 1: Fetch emails (with retry)
    const emails = await step.runAction(
      internal.gmail.fetchRecent,
      { userId },
      { retry: { maxAttempts: 5, initialBackoffMs: 1000 } }
    )

    // Step 2: Extract action items
    const actionItems = await step.runAction(internal.arlo.extractActionItems, { emails })

    // Step 3: Create tasks
    for (const item of actionItems) {
      await step.runMutation(internal.tasks.create, {
        title: item.title,
        source: 'gmail',
        createdBy: 'arlo',
      })
    }
  },
})
```

### Tool Definition Pattern

```typescript
import { createTool } from '@convex-dev/agent'
import { z } from 'zod/v3'

export const createTask = createTool({
  description: 'Create a new task in the workspace',
  args: z.object({
    title: z.string().describe('Task title'),
    due: z.number().optional().describe('Due date as unix timestamp'),
    assignee: z.enum(['user', 'arlo']).optional(),
  }),
  handler: async (ctx, args): Promise<{ taskId: string }> => {
    const taskId = await ctx.runMutation(internal.tasks.create, {
      ...args,
      createdBy: 'arlo',
    })
    return { taskId }
  },
})
```

### Answered Questions

| Question                        | Answer                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Human-in-the-loop support?      | **Yes** — via tool calls without handlers, save tool result when human responds |
| Workflow suspension/resumption? | **Yes** — `@convex-dev/workflow` provides durable execution with step replay    |
| Execution time limits?          | ~5 min for actions, but workflows can span longer via step-based execution      |

### Architecture Insight

Threads are first-class citizens. Multiple agents and humans can participate in the same thread—maps perfectly to Arlo's "shared workspace" concept.

The human-in-the-loop pattern using tool calls is elegant: the LLM naturally requests approval as a tool call, we intercept it, wait for human response, then resume. This is exactly what Arlo needs for "ask before sending email" behavior.

---

## Architecture Patterns

### Comparison: Convex Agent vs Lead Agent/Workflow

| Capability                     | Convex Agent              | Lead Agent/Workflow       |
| ------------------------------ | ------------------------- | ------------------------- |
| **Message persistence**        | Built-in threads          | You build it              |
| **Real-time streaming**        | Websocket delta           | HTTP streaming            |
| **Context injection**          | Automatic + vector search | Manual                    |
| **Human-in-the-loop**          | **Yes** — via tool calls  | First-class (Slack gates) |
| **Durable execution**          | `@convex-dev/workflow`    | Workflow DevKit           |
| **Proactive scheduling**       | Convex cron               | Workflow sleep()          |
| **Multi-agent threads**        | Native                    | Not built-in              |
| **Integration with Convex DB** | Native                    | Requires bridging         |

### Recommendation for Arlo

**Use Convex Agent (`@convex-dev/agent`) as foundation:**

- Already on Convex, thread model fits shared workspace concept
- Human-in-the-loop supported via tool call pattern
- Durable workflows via `@convex-dev/workflow`
- Native integration, no bridging needed

**Adopt these patterns:**

1. **Tool limits** (`stopWhen: stepCountIs(10)`) for cost control
2. **`generateObject`** for structured categorization (email → action item vs FYI)
3. **Tool-based approval** for external actions (tool without handler → pause → resume)
4. **Mutation + async action** for optimistic UI updates
5. **Workflows** for multi-step durable operations (email scanning, etc.)

---

## Open Questions

Tracked questions that need investigation:

| Question                                    | Status         | Notes                                       |
| ------------------------------------------- | -------------- | ------------------------------------------- |
| Convex workflow human-in-the-loop support?  | **Resolved**   | Yes — via tool calls without handlers       |
| Execution time limits for Convex actions?   | **Resolved**   | ~5 min, but workflows span longer via steps |
| Hybrid approach (Convex + Vercel Workflow)? | **Not needed** | Convex Agent has all required capabilities  |
| Best practices for Gmail OAuth in Convex?   | Open           | Need to research Nango vs direct OAuth      |
| Convex file storage for email attachments?  | Open           | Built-in support, need to test              |

---

## References

- Convex Docs: https://docs.convex.dev
- Convex Agent Docs: https://docs.convex.dev/agents
- Vercel AI SDK: https://sdk.vercel.ai
- Vercel Workflow: https://useworkflow.dev
- Lead Agent Repo: https://github.com/vercel-labs/lead-agent
