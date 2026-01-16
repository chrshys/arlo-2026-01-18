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
  activity: defineTable({
    action: v.string(),
    actor: v.union(v.literal('user'), v.literal('arlo')),
    outcome: v.union(v.literal('success'), v.literal('error')),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_created_at', ['createdAt']),
})
