'use node'

import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../../_generated/api'
import { Id } from '../../_generated/dataModel'
import { getNangoClient } from '../../lib/nango'
import { GOOGLE_CALENDAR_PROVIDER } from '../../lib/integrationConstants'

function getUserId(ctx: { userId?: string }): Id<'users'> {
  if (!ctx.userId) {
    throw new Error('User context not available')
  }
  return ctx.userId as Id<'users'>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCalendarConnection(ctx: any, userId: Id<'users'>) {
  const integration = (await ctx.runQuery(internal.integrations.getByUserIdAndProvider, {
    userId,
    provider: GOOGLE_CALENDAR_PROVIDER,
  })) as {
    _id: Id<'integrations'>
    nangoConnectionId: string
    status: string
  } | null

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

  return { integration }
}

export const getCalendarEvents = createTool({
  description: 'Get upcoming calendar events from Google Calendar',
  args: z.object({
    startDate: z.string().optional().describe('Start date in ISO format (defaults to now)'),
    endDate: z.string().optional().describe('End date in ISO format (defaults to 7 days from now)'),
    query: z.string().optional().describe('Search query to filter events'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getCalendarConnection(ctx, userId)

    if ('error' in result) {
      return { events: [], error: result.error }
    }

    const nango = getNangoClient()
    const now = new Date()
    const timeMin = args.startDate || now.toISOString()
    const timeMax = args.endDate || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    try {
      const params: Record<string, string> = {
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
      }
      if (args.query) {
        params.q = args.query
      }

      const response = await nango.proxy({
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
        params,
      })

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

      const events =
        (
          response.data as {
            items?: Array<{
              id: string
              summary: string
              start: { dateTime?: string; date?: string }
              end: { dateTime?: string; date?: string }
              location?: string
              description?: string
            }>
          }
        ).items || []

      return {
        events: events.map((e) => ({
          id: e.id,
          title: e.summary,
          start: e.start.dateTime || e.start.date,
          end: e.end.dateTime || e.end.date,
          location: e.location,
          description: e.description,
        })),
      }
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

    const nango = getNangoClient()

    try {
      const response = await nango.proxy({
        method: 'POST',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
        data: {
          summary: args.title,
          start: { dateTime: args.startTime },
          end: { dateTime: args.endTime },
          description: args.description,
          location: args.location,
          attendees: args.attendees?.map((email) => ({ email })),
        },
      })

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
        eventId: (response.data as { id: string }).id,
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

    const nango = getNangoClient()

    try {
      const updateData: Record<string, unknown> = {}
      if (args.title) updateData.summary = args.title
      if (args.startTime) updateData.start = { dateTime: args.startTime }
      if (args.endTime) updateData.end = { dateTime: args.endTime }
      if (args.description) updateData.description = args.description
      if (args.location) updateData.location = args.location

      await nango.proxy({
        method: 'PATCH',
        endpoint: `/calendar/v3/calendars/primary/events/${args.eventId}`,
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
        data: updateData,
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

    const nango = getNangoClient()

    try {
      await nango.proxy({
        method: 'DELETE',
        endpoint: `/calendar/v3/calendars/primary/events/${args.eventId}`,
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
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

    const nango = getNangoClient()

    try {
      const response = await nango.proxy({
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: result.integration.nangoConnectionId,
        providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
        params: {
          timeMin: args.startTime,
          timeMax: args.endTime,
          singleEvents: 'true',
        },
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      const events = (response.data as { items?: Array<unknown> }).items || []
      const available = events.length === 0

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'check_availability',
        actor: 'arlo',
        outcome: 'success',
        details: available ? 'Time slot is available' : `Found ${events.length} conflicting events`,
      })

      return {
        available,
        message: available
          ? 'This time slot is free'
          : `There are ${events.length} event(s) during this time`,
        conflictCount: events.length,
      }
    } catch (error) {
      console.error('Failed to check availability:', error)
      return { available: false, error: 'Failed to check calendar availability' }
    }
  },
})
