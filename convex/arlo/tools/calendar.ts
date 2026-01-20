import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../../_generated/api'
import { Id } from '../../_generated/dataModel'
import { GOOGLE_CALENDAR_PROVIDER } from '../../lib/integrationConstants'

// Exported for testing
export function getUserId(ctx: { userId?: string }): Id<'users'> {
  if (!ctx.userId) {
    throw new Error('User context not available')
  }
  return ctx.userId as Id<'users'>
}

export type CalendarConnectionResult =
  | { error: string }
  | {
      integration: { _id: Id<'integrations'>; nangoConnectionId: string; status: string }
      timezone: string
    }

// Exported for testing
export async function getCalendarConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userId: Id<'users'>
): Promise<CalendarConnectionResult> {
  const [integration, timezone] = await Promise.all([
    ctx.runQuery(internal.integrations.getByUserIdAndProvider, {
      userId,
      provider: GOOGLE_CALENDAR_PROVIDER,
    }) as Promise<{
      _id: Id<'integrations'>
      nangoConnectionId: string
      status: string
    } | null>,
    ctx.runQuery(internal.users.getTimezone, { userId }) as Promise<string>,
  ])

  if (!integration) {
    return {
      error: 'Google Calendar is not connected. Please connect it in Settings → Integrations.',
    }
  }

  if (integration.status !== 'active') {
    return {
      error: 'Google Calendar connection has expired. Please reconnect in Settings → Integrations.',
    }
  }

  return { integration, timezone }
}

// Convert a date string to full ISO 8601 format for Google Calendar API
// Exported for testing
export function toISODateTime(dateStr: string, endOfDay = false): string {
  // If already looks like ISO datetime, return as-is
  if (dateStr.includes('T')) {
    return dateStr
  }
  // Otherwise assume it's a date like "2024-12-18" and add time
  const time = endOfDay ? 'T23:59:59Z' : 'T00:00:00Z'
  return `${dateStr}${time}`
}

export const getCalendarEvents = createTool({
  description: 'Get upcoming calendar events from Google Calendar',
  args: z.object({
    startDate: z
      .string()
      .optional()
      .describe('Start date (YYYY-MM-DD or ISO datetime, defaults to now)'),
    endDate: z
      .string()
      .optional()
      .describe('End date (YYYY-MM-DD or ISO datetime, defaults to 7 days from now)'),
    query: z.string().optional().describe('Search query to filter events'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { events: [], error: result.error }
    }

    const now = new Date()
    const timeMin = args.startDate ? toISODateTime(args.startDate, false) : now.toISOString()
    const timeMax = args.endDate
      ? toISODateTime(args.endDate, true)
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    try {
      const response = (await ctx.runAction(internal.arlo.calendarActions.getEvents, {
        nangoConnectionId: result.integration.nangoConnectionId,
        timeMin,
        timeMax,
        query: args.query,
      })) as {
        events: Array<{
          id: string
          title: string
          start: string | undefined
          end: string | undefined
          location: string | undefined
          description: string | undefined
        }>
      }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'get_calendar_events',
        actor: 'arlo',
        outcome: 'success',
        details: `Retrieved calendar events`,
      })

      return { events: response.events }
    } catch (error) {
      console.error('Failed to get calendar events:', error)
      return { events: [], error: 'Failed to retrieve calendar events' }
    }
  },
})

export const createCalendarEvent = createTool({
  description: 'Create a new event in Google Calendar',
  args: z.object({
    title: z.string().describe('Event title'),
    startTime: z.string().describe('Start time in ISO format'),
    endTime: z.string().describe('End time in ISO format'),
    description: z.string().optional().describe('Event description'),
    location: z.string().optional().describe('Event location'),
    attendees: z.array(z.string()).optional().describe('List of attendee emails'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { eventId: null, error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.calendarActions.createEvent, {
        nangoConnectionId: result.integration.nangoConnectionId,
        title: args.title,
        startTime: args.startTime,
        endTime: args.endTime,
        description: args.description,
        location: args.location,
        attendees: args.attendees,
        timezone: result.timezone,
      })) as { eventId: string }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'create_calendar_event',
        actor: 'arlo',
        outcome: 'success',
        details: `Created calendar event: ${args.title}`,
      })

      return {
        eventId: response.eventId,
        message: `Created calendar event: "${args.title}"`,
      }
    } catch (error) {
      console.error('Failed to create calendar event:', error)
      return { eventId: null, error: 'Failed to create calendar event' }
    }
  },
})

export const updateCalendarEvent = createTool({
  description: 'Update an existing calendar event',
  args: z.object({
    eventId: z.string().describe('The ID of the event to update'),
    title: z.string().optional().describe('New event title'),
    startTime: z.string().optional().describe('New start time in ISO format'),
    endTime: z.string().optional().describe('New end time in ISO format'),
    description: z.string().optional().describe('New event description'),
    location: z.string().optional().describe('New event location'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      await ctx.runAction(internal.arlo.calendarActions.updateEvent, {
        nangoConnectionId: result.integration.nangoConnectionId,
        eventId: args.eventId,
        title: args.title,
        startTime: args.startTime,
        endTime: args.endTime,
        description: args.description,
        location: args.location,
        timezone: result.timezone,
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'update_calendar_event',
        actor: 'arlo',
        outcome: 'success',
        targetId: args.eventId,
        details: 'Updated calendar event',
      })

      return { success: true, message: 'Calendar event updated' }
    } catch (error) {
      console.error('Failed to update calendar event:', error)
      return { success: false, error: 'Failed to update calendar event' }
    }
  },
})

export const deleteCalendarEvent = createTool({
  description: 'Delete a calendar event. Use with caution - this is permanent.',
  args: z.object({
    eventId: z.string().describe('The ID of the event to delete'),
    confirmed: z.boolean().describe('Set to true to confirm deletion'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)

    if (!args.confirmed) {
      return {
        success: false,
        message: 'Please confirm you want to delete this event by setting confirmed: true',
      }
    }

    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      await ctx.runAction(internal.arlo.calendarActions.deleteEvent, {
        nangoConnectionId: result.integration.nangoConnectionId,
        eventId: args.eventId,
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'delete_calendar_event',
        actor: 'arlo',
        outcome: 'success',
        targetId: args.eventId,
        details: 'Deleted calendar event',
      })

      return { success: true, message: 'Calendar event deleted' }
    } catch (error) {
      console.error('Failed to delete calendar event:', error)
      return { success: false, error: 'Failed to delete calendar event' }
    }
  },
})

export const checkCalendarAvailability = createTool({
  description: 'Check if a time slot is free on the calendar',
  args: z.object({
    startTime: z.string().describe('Start time to check in ISO format'),
    endTime: z.string().describe('End time to check in ISO format'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { available: false, error: result.error }
    }

    try {
      const response = (await ctx.runAction(internal.arlo.calendarActions.checkAvailability, {
        nangoConnectionId: result.integration.nangoConnectionId,
        startTime: args.startTime,
        endTime: args.endTime,
      })) as { available: boolean; conflictCount: number }

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'check_availability',
        actor: 'arlo',
        outcome: 'success',
        details: response.available
          ? 'Time slot is available'
          : `Found ${response.conflictCount} conflicting events`,
      })

      return {
        available: response.available,
        message: response.available
          ? 'This time slot is free'
          : `There are ${response.conflictCount} event(s) during this time`,
        conflictCount: response.conflictCount,
      }
    } catch (error) {
      console.error('Failed to check availability:', error)
      return { available: false, error: 'Failed to check calendar availability' }
    }
  },
})
