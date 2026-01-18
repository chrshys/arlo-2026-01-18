import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireCurrentUser } from './lib/auth'

export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const user = await requireCurrentUser(ctx)
    const sections = await ctx.db
      .query('sections')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
    return sections.filter((s) => s.userId === user._id)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Verify project belongs to user
    const project = await ctx.db.get(args.projectId)
    if (!project || project.userId !== user._id) throw new Error('Project not found')

    const sections = await ctx.db
      .query('sections')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()
    const maxSortOrder = sections.reduce((max, s) => Math.max(max, s.sortOrder), -1)

    return await ctx.db.insert('sections', {
      userId: user._id,
      name: args.name,
      projectId: args.projectId,
      sortOrder: maxSortOrder + 1,
      createdAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('sections'),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await requireCurrentUser(ctx)
    const section = await ctx.db.get(id)
    if (!section || section.userId !== user._id) throw new Error('Not found')

    await ctx.db.patch(id, { name })
  },
})

export const remove = mutation({
  args: { id: v.id('sections') },
  handler: async (ctx, { id }) => {
    const user = await requireCurrentUser(ctx)
    const section = await ctx.db.get(id)
    if (!section || section.userId !== user._id) throw new Error('Not found')

    // Move tasks in this section to have no section
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', section.projectId))
      .collect()

    for (const task of tasks) {
      if (task.sectionId === id && task.userId === user._id) {
        await ctx.db.patch(task._id, { sectionId: undefined })
      }
    }

    await ctx.db.delete(id)
  },
})

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id('sections')),
  },
  handler: async (ctx, { orderedIds }) => {
    const user = await requireCurrentUser(ctx)
    for (let i = 0; i < orderedIds.length; i++) {
      const section = await ctx.db.get(orderedIds[i])
      if (section && section.userId === user._id) {
        await ctx.db.patch(orderedIds[i], { sortOrder: i })
      }
    }
  },
})
