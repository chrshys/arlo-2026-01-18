import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query('sections')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect()
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const sections = await ctx.db
      .query('sections')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()
    const maxSortOrder = sections.reduce((max, s) => Math.max(max, s.sortOrder), -1)

    return await ctx.db.insert('sections', {
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
    await ctx.db.patch(id, { name })
  },
})

export const remove = mutation({
  args: { id: v.id('sections') },
  handler: async (ctx, { id }) => {
    // Move tasks in this section to have no section
    const section = await ctx.db.get(id)
    if (!section) return

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', section.projectId))
      .collect()

    for (const task of tasks) {
      if (task.sectionId === id) {
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
    for (let i = 0; i < orderedIds.length; i++) {
      await ctx.db.patch(orderedIds[i], { sortOrder: i })
    }
  },
})
