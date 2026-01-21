import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Users synced from Clerk
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    timezone: v.optional(v.string()), // IANA timezone, e.g., "America/New_York"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email']),

  folders: defineTable({
    userId: v.id('users'),
    name: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  projects: defineTable({
    userId: v.id('users'),
    name: v.string(),
    folderId: v.optional(v.id('folders')),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_folder', ['folderId']),

  sections: defineTable({
    userId: v.id('users'),
    name: v.string(),
    projectId: v.id('projects'),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_project', ['projectId']),

  tasks: defineTable({
    userId: v.id('users'),
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
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_project', ['projectId'])
    .index('by_due_date', ['dueDate']),

  subtasks: defineTable({
    userId: v.id('users'),
    title: v.string(),
    taskId: v.id('tasks'),
    completed: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_task', ['taskId']),

  notes: defineTable({
    userId: v.id('users'),
    title: v.string(),
    content: v.string(),
    projectId: v.optional(v.id('projects')),
    sectionId: v.optional(v.id('sections')),
    sortOrder: v.optional(v.number()),
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_project', ['projectId'])
    .index('by_updated', ['updatedAt']),

  activity: defineTable({
    userId: v.id('users'),
    action: v.string(),
    actor: v.union(v.literal('user'), v.literal('arlo')),
    outcome: v.union(v.literal('success'), v.literal('error')),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_created_at', ['createdAt']),

  deskItems: defineTable({
    userId: v.id('users'),

    // Item classification
    type: v.union(
      v.literal('approval'),
      v.literal('question'),
      v.literal('task'),
      v.literal('draft'),
      v.literal('progress')
    ),
    zone: v.union(v.literal('attention'), v.literal('pinned'), v.literal('working')),

    // Content
    title: v.string(),
    description: v.optional(v.string()),

    // Type-specific data stored as JSON
    data: v.optional(v.any()),

    // Relationships
    sourceThreadId: v.optional(v.string()),
    linkedEntityId: v.optional(v.string()),
    linkedEntityType: v.optional(v.string()),

    // Metadata
    createdBy: v.union(v.literal('user'), v.literal('arlo')),
    priority: v.optional(v.number()),

    // Resolution
    status: v.union(v.literal('active'), v.literal('resolved'), v.literal('dismissed')),
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_user_zone', ['userId', 'zone'])
    .index('by_user_status', ['userId', 'status']),

  integrations: defineTable({
    userId: v.id('users'),
    provider: v.string(),
    nangoConnectionId: v.string(),
    status: v.union(v.literal('active'), v.literal('expired'), v.literal('revoked')),
    scopes: v.array(v.string()),
    connectedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    enabledCalendarIds: v.optional(v.array(v.string())),
    // Gmail-specific settings
    gmailPermissionLevel: v.optional(
      v.union(v.literal('read'), v.literal('read_draft'), v.literal('read_draft_send'))
    ),
    gmailRequireConfirmation: v.optional(v.boolean()),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_provider', ['userId', 'provider'])
    .index('by_nango_connection', ['nangoConnectionId']),
})
