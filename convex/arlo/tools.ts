import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../_generated/api'
import { Id } from '../_generated/dataModel'

export const createTask = createTool({
  description: 'Create a new task. Can optionally specify a project, due date, and priority.',
  args: z.object({
    title: z.string().describe('The task title'),
    description: z.string().optional().describe('Optional task description'),
    projectId: z.string().optional().describe('Optional project ID to add the task to'),
    priority: z.enum(['none', 'low', 'medium', 'high']).optional().describe('Task priority level'),
    dueDate: z
      .string()
      .optional()
      .describe('Due date in ISO format (YYYY-MM-DD) or relative like "tomorrow"'),
  }),
  handler: async (ctx, args): Promise<{ taskId: string; message: string }> => {
    // Parse due date if provided
    let dueDateTimestamp: number | undefined
    if (args.dueDate) {
      const parsed = parseDueDate(args.dueDate)
      if (parsed) {
        dueDateTimestamp = parsed
      }
    }

    const taskId = await ctx.runMutation(internal.tasks.create, {
      title: args.title,
      description: args.description,
      projectId: args.projectId as Id<'projects'> | undefined,
      priority: args.priority,
      dueDate: dueDateTimestamp,
      createdBy: 'arlo',
    })

    await ctx.runMutation(internal.activity.log, {
      action: 'create_task',
      actor: 'arlo',
      outcome: 'success',
      targetId: taskId,
      details: `Created task: ${args.title}${args.projectId ? ' in project' : ''}${args.dueDate ? ` due ${args.dueDate}` : ''}`,
    })

    return {
      taskId,
      message: `Created task: "${args.title}"${args.priority && args.priority !== 'none' ? ` (${args.priority} priority)` : ''}${args.dueDate ? ` due ${args.dueDate}` : ''}`,
    }
  },
})

export const listTasks = createTool({
  description:
    'List tasks. Can filter by project or list all pending tasks. Use this to see what tasks exist.',
  args: z.object({
    projectId: z.string().optional().describe('Optional project ID to filter by'),
    includeCompleted: z.boolean().optional().describe('Include completed tasks'),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    tasks: Array<{
      id: string
      title: string
      status: string
      priority?: string
      dueDate?: string
    }>
  }> => {
    const tasks = await ctx.runQuery(internal.tasks.listPending)

    // Filter by project if specified
    let filteredTasks = tasks
    if (args.projectId) {
      filteredTasks = tasks.filter((t) => t.projectId === args.projectId)
    }

    // Filter out completed if not requested
    if (!args.includeCompleted) {
      filteredTasks = filteredTasks.filter((t) => t.status === 'pending')
    }

    await ctx.runMutation(internal.activity.log, {
      action: 'list_tasks',
      actor: 'arlo',
      outcome: 'success',
      details: `Listed ${filteredTasks.length} tasks`,
    })

    return {
      tasks: filteredTasks.map((t) => ({
        id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority ?? undefined,
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : undefined,
      })),
    }
  },
})

export const completeTask = createTool({
  description: 'Mark a task as completed',
  args: z.object({
    taskId: z.string().describe('The ID of the task to complete'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    await ctx.runMutation(internal.tasks.complete, {
      taskId: args.taskId as Id<'tasks'>,
    })
    await ctx.runMutation(internal.activity.log, {
      action: 'complete_task',
      actor: 'arlo',
      outcome: 'success',
      targetId: args.taskId,
      details: 'Completed task',
    })
    return { message: 'Task completed' }
  },
})

export const moveTask = createTool({
  description: 'Move a task to a different project or section',
  args: z.object({
    taskId: z.string().describe('The ID of the task to move'),
    projectId: z.string().optional().describe('Target project ID (omit to move to Inbox)'),
    sectionId: z.string().optional().describe('Target section ID within the project'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    await ctx.runMutation(internal.arlo.mutations.moveTask, {
      taskId: args.taskId as Id<'tasks'>,
      projectId: args.projectId as Id<'projects'> | undefined,
      sectionId: args.sectionId as Id<'sections'> | undefined,
    })

    await ctx.runMutation(internal.activity.log, {
      action: 'move_task',
      actor: 'arlo',
      outcome: 'success',
      targetId: args.taskId,
      details: args.projectId ? 'Moved task to project' : 'Moved task to Inbox',
    })

    return {
      message: args.projectId ? 'Task moved to project' : 'Task moved to Inbox',
    }
  },
})

export const setReminder = createTool({
  description: 'Add a reminder to a task',
  args: z.object({
    taskId: z.string().describe('The ID of the task'),
    reminderTime: z
      .string()
      .describe('Reminder time in ISO format or relative like "tomorrow 9am"'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    const reminderTimestamp = parseReminderTime(args.reminderTime)
    if (!reminderTimestamp) {
      return { message: `Could not parse reminder time: ${args.reminderTime}` }
    }

    await ctx.runMutation(internal.arlo.mutations.addReminder, {
      taskId: args.taskId as Id<'tasks'>,
      reminderTime: reminderTimestamp,
    })

    await ctx.runMutation(internal.activity.log, {
      action: 'set_reminder',
      actor: 'arlo',
      outcome: 'success',
      targetId: args.taskId,
      details: `Set reminder for ${new Date(reminderTimestamp).toLocaleString()}`,
    })

    return {
      message: `Reminder set for ${new Date(reminderTimestamp).toLocaleString()}`,
    }
  },
})

export const listProjects = createTool({
  description: 'List all projects and folders to understand the task organization structure',
  args: z.object({}),
  handler: async (
    ctx
  ): Promise<{
    projects: Array<{ id: string; name: string; folderId?: string }>
    folders: Array<{ id: string; name: string }>
  }> => {
    const result = await ctx.runQuery(internal.arlo.mutations.listProjectsAndFolders)

    await ctx.runMutation(internal.activity.log, {
      action: 'list_projects',
      actor: 'arlo',
      outcome: 'success',
      details: `Listed ${result.projects.length} projects and ${result.folders.length} folders`,
    })

    return result
  },
})

export const setTaskPriority = createTool({
  description: 'Set the priority of a task',
  args: z.object({
    taskId: z.string().describe('The ID of the task'),
    priority: z.enum(['none', 'low', 'medium', 'high']).describe('The priority level'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    await ctx.runMutation(internal.arlo.mutations.updateTaskPriority, {
      taskId: args.taskId as Id<'tasks'>,
      priority: args.priority,
    })

    await ctx.runMutation(internal.activity.log, {
      action: 'set_priority',
      actor: 'arlo',
      outcome: 'success',
      targetId: args.taskId,
      details: `Set priority to ${args.priority}`,
    })

    return { message: `Priority set to ${args.priority}` }
  },
})

export const setDueDate = createTool({
  description: 'Set the due date of a task',
  args: z.object({
    taskId: z.string().describe('The ID of the task'),
    dueDate: z.string().describe('Due date in ISO format (YYYY-MM-DD) or relative like "tomorrow"'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    const dueDateTimestamp = parseDueDate(args.dueDate)
    if (!dueDateTimestamp) {
      return { message: `Could not parse due date: ${args.dueDate}` }
    }

    await ctx.runMutation(internal.arlo.mutations.updateTaskDueDate, {
      taskId: args.taskId as Id<'tasks'>,
      dueDate: dueDateTimestamp,
    })

    await ctx.runMutation(internal.activity.log, {
      action: 'set_due_date',
      actor: 'arlo',
      outcome: 'success',
      targetId: args.taskId,
      details: `Set due date to ${new Date(dueDateTimestamp).toLocaleDateString()}`,
    })

    return {
      message: `Due date set to ${new Date(dueDateTimestamp).toLocaleDateString()}`,
    }
  },
})

// Helper functions
function parseDueDate(input: string): number | undefined {
  const lower = input.toLowerCase().trim()
  const now = new Date()

  if (lower === 'today') {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return date.getTime()
  }

  if (lower === 'tomorrow') {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59)
    return date.getTime()
  }

  if (lower === 'next week') {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59)
    return date.getTime()
  }

  // Try parsing as ISO date
  const parsed = new Date(input)
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(23, 59, 59, 999)
    return parsed.getTime()
  }

  return undefined
}

function parseReminderTime(input: string): number | undefined {
  const lower = input.toLowerCase().trim()
  const now = new Date()

  // Handle "tomorrow 9am" format
  const tomorrowMatch = lower.match(/tomorrow\s+(\d{1,2})(am|pm)?/i)
  if (tomorrowMatch) {
    let hours = parseInt(tomorrowMatch[1], 10)
    const period = tomorrowMatch[2]?.toLowerCase()
    if (period === 'pm' && hours < 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0

    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, 0, 0)
    return date.getTime()
  }

  // Handle "today 3pm" format
  const todayMatch = lower.match(/today\s+(\d{1,2})(am|pm)?/i)
  if (todayMatch) {
    let hours = parseInt(todayMatch[1], 10)
    const period = todayMatch[2]?.toLowerCase()
    if (period === 'pm' && hours < 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0

    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, 0, 0)
    return date.getTime()
  }

  // Try parsing as ISO datetime
  const parsed = new Date(input)
  if (!isNaN(parsed.getTime())) {
    return parsed.getTime()
  }

  return undefined
}

// Note tools

export const createNote = createTool({
  description: 'Create a new note. Can optionally specify a project.',
  args: z.object({
    title: z.string().describe('The note title'),
    content: z.string().optional().describe('Optional note content in markdown format'),
    projectId: z.string().optional().describe('Optional project ID to add the note to'),
  }),
  handler: async (ctx, args): Promise<{ noteId: string; message: string }> => {
    const noteId = await ctx.runMutation(internal.notes.create, {
      title: args.title,
      content: args.content,
      projectId: args.projectId as Id<'projects'> | undefined,
      createdBy: 'arlo',
    })

    await ctx.runMutation(internal.activity.log, {
      action: 'create_note',
      actor: 'arlo',
      outcome: 'success',
      targetId: noteId,
      details: `Created note: ${args.title}${args.projectId ? ' in project' : ''}`,
    })

    return {
      noteId,
      message: `Created note: "${args.title}"`,
    }
  },
})

export const listNotes = createTool({
  description: 'List all notes. Use this to see what notes exist.',
  args: z.object({
    projectId: z.string().optional().describe('Optional project ID to filter by'),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    notes: Array<{
      id: string
      title: string
      updatedAt: string
    }>
  }> => {
    const notes = await ctx.runQuery(internal.notes.listAll)

    // Filter by project if specified
    let filteredNotes = notes
    if (args.projectId) {
      filteredNotes = notes.filter((n) => n.projectId === args.projectId)
    }

    await ctx.runMutation(internal.activity.log, {
      action: 'list_notes',
      actor: 'arlo',
      outcome: 'success',
      details: `Listed ${filteredNotes.length} notes`,
    })

    return {
      notes: filteredNotes.map((n) => ({
        id: n._id,
        title: n.title,
        updatedAt: new Date(n.updatedAt).toLocaleString(),
      })),
    }
  },
})

export const updateNote = createTool({
  description: 'Update the content of an existing note',
  args: z.object({
    noteId: z.string().describe('The ID of the note to update'),
    content: z.string().describe('The new content in markdown format'),
  }),
  handler: async (ctx, args): Promise<{ message: string }> => {
    await ctx.runMutation(internal.notes.updateContentInternal, {
      id: args.noteId as Id<'notes'>,
      content: args.content,
    })

    await ctx.runMutation(internal.activity.log, {
      action: 'update_note',
      actor: 'arlo',
      outcome: 'success',
      targetId: args.noteId,
      details: 'Updated note content',
    })

    return { message: 'Note updated' }
  },
})
