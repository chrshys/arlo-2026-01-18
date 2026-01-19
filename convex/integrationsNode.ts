'use node'

import { v } from 'convex/values'
import { action } from './_generated/server'
import { getNangoClient } from './lib/nango'
import { getCurrentUserFromAction } from './lib/auth'

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
