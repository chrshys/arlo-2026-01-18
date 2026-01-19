import { v } from 'convex/values'
import { query, mutation, action, internalMutation } from './_generated/server'
import { getNangoClient, GOOGLE_CALENDAR_PROVIDER, GOOGLE_CALENDAR_SCOPES } from './lib/nango'
import { requireCurrentUser, getCurrentUserFromAction } from './lib/auth'

// Query: Get user's integrations
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    return ctx.db
      .query('integrations')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
  },
})

// Query: Get a specific integration by provider
export const getByProvider = query({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    return ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', user._id).eq('provider', args.provider)
      )
      .first()
  },
})

// Action: Create a Nango session for OAuth
export const createSession = action({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const userInfo = await getCurrentUserFromAction(ctx)
    if (!userInfo) {
      throw new Error('Unauthorized')
    }
    const nango = getNangoClient()

    const session = await nango.createConnectSession({
      end_user: {
        id: userInfo.clerkId,
        email: undefined,
        display_name: undefined,
      },
      allowed_integrations: [args.provider],
    })

    return { sessionToken: session.data.token }
  },
})

// Mutation: Save a new integration after OAuth completes
export const saveConnection = mutation({
  args: {
    provider: v.string(),
    nangoConnectionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    // Check if integration already exists
    const existing = await ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', user._id).eq('provider', args.provider)
      )
      .first()

    if (existing) {
      // Update existing integration
      await ctx.db.patch(existing._id, {
        nangoConnectionId: args.nangoConnectionId,
        status: 'active',
        connectedAt: Date.now(),
      })
      return existing._id
    }

    // Create new integration
    const scopes = args.provider === GOOGLE_CALENDAR_PROVIDER ? GOOGLE_CALENDAR_SCOPES : []

    return ctx.db.insert('integrations', {
      userId: user._id,
      provider: args.provider,
      nangoConnectionId: args.nangoConnectionId,
      status: 'active',
      scopes,
      connectedAt: Date.now(),
    })
  },
})

// Mutation: Disconnect an integration
export const disconnect = mutation({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_user_and_provider', (q) =>
        q.eq('userId', user._id).eq('provider', args.provider)
      )
      .first()

    if (integration) {
      await ctx.db.delete(integration._id)
    }
  },
})

// Internal mutation: Handle webhook events
export const handleWebhookEvent = internalMutation({
  args: {
    type: v.string(),
    connectionId: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query('integrations')
      .withIndex('by_nango_connection', (q) => q.eq('nangoConnectionId', args.connectionId))
      .first()

    if (!integration) {
      // Connection not in our system (might be initial creation)
      return
    }

    switch (args.type) {
      case 'auth.refresh_error':
        await ctx.db.patch(integration._id, { status: 'expired' })
        break
      case 'auth.revoked':
        await ctx.db.patch(integration._id, { status: 'revoked' })
        break
    }
  },
})

// Internal mutation: Update lastUsedAt timestamp
export const updateLastUsed = internalMutation({
  args: { integrationId: v.id('integrations') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, { lastUsedAt: Date.now() })
  },
})
