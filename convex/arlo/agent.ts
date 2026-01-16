import { Agent } from '@convex-dev/agent'
import { anthropic } from '@ai-sdk/anthropic'
import { components } from '../_generated/api'
import { createTask, listTasks, completeTask } from './tools'

export const arlo = new Agent(components.agent, {
  name: 'Arlo',
  chat: anthropic('claude-sonnet-4-20250514'),
  instructions: `You are Arlo, a personal assistant who shares a task workspace with the user.

You can create tasks, list tasks, and complete tasks. Be concise and helpful.
When the user asks you to do something that requires a task, create one.
When listing tasks, format them clearly.

Important behaviors:
- When you create a task, confirm what you created
- When listing tasks, present them in a readable format
- Be proactive about suggesting task creation when appropriate
- Keep responses brief but friendly`,
  tools: {
    createTask,
    listTasks,
    completeTask,
  },
  maxSteps: 5,
})
