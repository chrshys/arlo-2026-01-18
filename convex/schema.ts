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
