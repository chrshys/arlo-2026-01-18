import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { requireCurrentUser } from './lib/auth'

/**
 * Reorder sidebar items (folders and standalone projects) in a unified order.
 * Accepts an array of objects with id and type to support mixed ordering.
 */
export const reorder = mutation({
  args: {
    orderedItems: v.array(
      v.object({
        id: v.string(),
        type: v.union(v.literal('folder'), v.literal('project')),
      })
    ),
  },
  handler: async (ctx, { orderedItems }) => {
    const user = await requireCurrentUser(ctx)

    for (let i = 0; i < orderedItems.length; i++) {
      const item = orderedItems[i]

      if (item.type === 'folder') {
        const folderId = item.id as Id<'folders'>
        const folder = await ctx.db.get(folderId)
        if (folder && folder.userId === user._id) {
          await ctx.db.patch(folderId, { sortOrder: i })
        }
      } else {
        const projectId = item.id as Id<'projects'>
        const project = await ctx.db.get(projectId)
        if (project && project.userId === user._id && !project.folderId) {
          // Only update standalone projects (sidebar items)
          await ctx.db.patch(projectId, { sortOrder: i })
        }
      }
    }
  },
})
