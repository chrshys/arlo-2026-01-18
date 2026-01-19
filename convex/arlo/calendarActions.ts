'use node'

import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { getNangoClient } from '../lib/nango'
import { GOOGLE_CALENDAR_PROVIDER } from '../lib/integrationConstants'

// Get calendar events
export const getEvents = internalAction({
  args: {
    nangoConnectionId: v.string(),
    timeMin: v.string(),
    timeMax: v.string(),
    query: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const params: Record<string, string> = {
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
    }
    if (args.query) {
      params.q = args.query
    }

    const response = await nango.proxy({
      method: 'GET',
      endpoint: '/calendar/v3/calendars/primary/events',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
      params,
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
  },
})

// Create calendar event
export const createEvent = internalAction({
  args: {
    nangoConnectionId: v.string(),
    title: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'POST',
      endpoint: '/calendar/v3/calendars/primary/events',
      connectionId: args.nangoConnectionId,
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

    return {
      eventId: (response.data as { id: string }).id,
    }
  },
})

// Update calendar event
export const updateEvent = internalAction({
  args: {
    nangoConnectionId: v.string(),
    eventId: v.string(),
    title: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const updateData: Record<string, unknown> = {}
    if (args.title) updateData.summary = args.title
    if (args.startTime) updateData.start = { dateTime: args.startTime }
    if (args.endTime) updateData.end = { dateTime: args.endTime }
    if (args.description) updateData.description = args.description
    if (args.location) updateData.location = args.location

    await nango.proxy({
      method: 'PATCH',
      endpoint: `/calendar/v3/calendars/primary/events/${args.eventId}`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
      data: updateData,
    })

    return { success: true }
  },
})

// Delete calendar event
export const deleteEvent = internalAction({
  args: {
    nangoConnectionId: v.string(),
    eventId: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    await nango.proxy({
      method: 'DELETE',
      endpoint: `/calendar/v3/calendars/primary/events/${args.eventId}`,
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
    })

    return { success: true }
  },
})

// Check availability
export const checkAvailability = internalAction({
  args: {
    nangoConnectionId: v.string(),
    startTime: v.string(),
    endTime: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'GET',
      endpoint: '/calendar/v3/calendars/primary/events',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
      params: {
        timeMin: args.startTime,
        timeMax: args.endTime,
        singleEvents: 'true',
      },
    })

    const events = (response.data as { items?: Array<unknown> }).items || []

    return {
      available: events.length === 0,
      conflictCount: events.length,
    }
  },
})
