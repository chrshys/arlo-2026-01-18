'use node'

import { v } from 'convex/values'
import { action } from './_generated/server'
import { internal } from './_generated/api'
import { getNangoClient } from './lib/nango'
import { getCurrentUserFromAction } from './lib/auth'
import { GOOGLE_CALENDAR_PROVIDER } from './lib/integrationConstants'

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

interface Calendar {
  id: string
  name: string
  primary: boolean
  accessRole: string
}

type FetchCalendarsResult =
  | { calendars: Calendar[]; enabledCalendarIds: string[]; error?: undefined }
  | { calendars: []; error: string; enabledCalendarIds?: undefined }

// Action: Fetch calendars from Google Calendar for the current user
export const fetchCalendars = action({
  args: {},
  handler: async (ctx): Promise<FetchCalendarsResult> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    // Get user from Clerk ID
    const user = await ctx.runQuery(internal.users.getByClerkId, {
      clerkId: identity.subject,
    })
    if (!user) {
      throw new Error('User not found')
    }

    // Get Google Calendar integration
    const integration = await ctx.runQuery(internal.integrations.getByUserIdAndProvider, {
      userId: user._id,
      provider: GOOGLE_CALENDAR_PROVIDER,
    })

    if (!integration || integration.status !== 'active') {
      return { calendars: [], error: 'Google Calendar not connected' }
    }

    // Fetch calendars from Google via Nango
    const result = (await ctx.runAction(internal.arlo.calendarActions.listCalendars, {
      nangoConnectionId: integration.nangoConnectionId,
    })) as { calendars: Calendar[] }

    return {
      calendars: result.calendars,
      enabledCalendarIds: integration.enabledCalendarIds || ['primary'],
    }
  },
})
