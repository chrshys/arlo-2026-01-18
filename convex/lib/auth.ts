import { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server'

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique()

  return user
}

export async function requireCurrentUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx)
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function getCurrentUserFromAction(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return { clerkId: identity.subject }
}
