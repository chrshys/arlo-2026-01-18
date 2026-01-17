import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  folders: defineTable({
    name: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
  }),

  projects: defineTable({
    name: v.string(),
    folderId: v.optional(v.id('folders')), // null = Inbox
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index('by_folder', ['folderId']),

  sections: defineTable({
    name: v.string(),
    projectId: v.id('projects'),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index('by_project', ['projectId']),

  tasks: defineTable({
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
    .index('by_status', ['status'])
    .index('by_project', ['projectId'])
    .index('by_due_date', ['dueDate']),

  subtasks: defineTable({
    title: v.string(),
    taskId: v.id('tasks'),
    completed: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index('by_task', ['taskId']),

  notes: defineTable({
    title: v.string(),
    content: v.string(), // ProseMirror JSON
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    sortOrder: v.optional(v.number()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_updated', ['updatedAt']),

  activity: defineTable({
    action: v.string(),
    actor: v.union(v.literal('user'), v.literal('arlo')),
    outcome: v.union(v.literal('success'), v.literal('error')),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_created_at', ['createdAt']),
})
