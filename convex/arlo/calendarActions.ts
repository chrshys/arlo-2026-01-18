'use node'

import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { getNangoClient } from '../lib/nango'
import { GOOGLE_CALENDAR_PROVIDER } from '../lib/integrationConstants'

// Fallback timezone if user hasn't set one
const DEFAULT_TIMEZONE = 'America/New_York'

// Calendar type from Google Calendar API
interface GoogleCalendar {
  id: string
  summary: string
  primary?: boolean
  accessRole: string
  backgroundColor?: string
}

// List all calendars the user has access to
export const listCalendars = internalAction({
  args: {
    nangoConnectionId: v.string(),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'GET',
      endpoint: '/calendar/v3/users/me/calendarList',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
    })

    const calendars = (response.data as { items?: GoogleCalendar[] }).items || []

    return {
      calendars: calendars.map((c) => ({
        id: c.id,
        name: c.summary,
        primary: c.primary || false,
        accessRole: c.accessRole,
      })),
    }
  },
})

// Event type from Google Calendar API
interface GoogleEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  description?: string
}

// Get calendar events from enabled calendars only
export const getEvents = internalAction({
  args: {
    nangoConnectionId: v.string(),
    timeMin: v.string(),
    timeMax: v.string(),
    query: v.optional(v.string()),
    enabledCalendarIds: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    // Get enabled calendar IDs (default to primary only)
    const enabledIds = args.enabledCalendarIds || ['primary']

    // First, get all calendars
    const calendarListResponse = await nango.proxy({
      method: 'GET',
      endpoint: '/calendar/v3/users/me/calendarList',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
    })

    const allCalendars = (calendarListResponse.data as { items?: GoogleCalendar[] }).items || []

    // Filter to only enabled calendars
    const calendars = allCalendars.filter((cal) => enabledIds.includes(cal.id))

    const params: Record<string, string> = {
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
    }
    if (args.query) {
      params.q = args.query
    }

    // Query events from all calendars in parallel
    const eventPromises = calendars.map(async (calendar) => {
      try {
        const response = await nango.proxy({
          method: 'GET',
          endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`,
          connectionId: args.nangoConnectionId,
          providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
          params,
        })

        const events = (response.data as { items?: GoogleEvent[] }).items || []

        return events.map((e) => ({
          id: e.id,
          title: e.summary,
          start: e.start.dateTime || e.start.date,
          end: e.end.dateTime || e.end.date,
          location: e.location,
          description: e.description,
          calendarId: calendar.id,
          calendarName: calendar.summary,
        }))
      } catch (error) {
        // If we can't access a calendar, skip it rather than failing entirely
        console.warn(`Failed to fetch events from calendar ${calendar.id}:`, error)
        return []
      }
    })

    const allEventsArrays = await Promise.all(eventPromises)
    const allEvents = allEventsArrays.flat()

    // Sort by start time
    allEvents.sort((a, b) => {
      const aStart = a.start || ''
      const bStart = b.start || ''
      return aStart.localeCompare(bStart)
    })

    return { events: allEvents }
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
    timezone: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()
    const tz = args.timezone || DEFAULT_TIMEZONE

    const response = await nango.proxy({
      method: 'POST',
      endpoint: '/calendar/v3/calendars/primary/events',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
      data: {
        summary: args.title,
        start: { dateTime: args.startTime, timeZone: tz },
        end: { dateTime: args.endTime, timeZone: tz },
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
    timezone: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()
    const tz = args.timezone || DEFAULT_TIMEZONE

    const updateData: Record<string, unknown> = {}
    if (args.title) updateData.summary = args.title
    if (args.startTime) updateData.start = { dateTime: args.startTime, timeZone: tz }
    if (args.endTime) updateData.end = { dateTime: args.endTime, timeZone: tz }
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

// Check availability across enabled calendars only
export const checkAvailability = internalAction({
  args: {
    nangoConnectionId: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    enabledCalendarIds: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    // Get enabled calendar IDs (default to primary only)
    const enabledIds = args.enabledCalendarIds || ['primary']

    // First, get all calendars
    const calendarListResponse = await nango.proxy({
      method: 'GET',
      endpoint: '/calendar/v3/users/me/calendarList',
      connectionId: args.nangoConnectionId,
      providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
    })

    const allCalendars = (calendarListResponse.data as { items?: GoogleCalendar[] }).items || []

    // Filter to only enabled calendars
    const calendars = allCalendars.filter((cal) => enabledIds.includes(cal.id))

    // Check events on enabled calendars in parallel
    const eventPromises = calendars.map(async (calendar) => {
      try {
        const response = await nango.proxy({
          method: 'GET',
          endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`,
          connectionId: args.nangoConnectionId,
          providerConfigKey: GOOGLE_CALENDAR_PROVIDER,
          params: {
            timeMin: args.startTime,
            timeMax: args.endTime,
            singleEvents: 'true',
          },
        })

        return (response.data as { items?: Array<unknown> }).items || []
      } catch (error) {
        console.warn(`Failed to check calendar ${calendar.id}:`, error)
        return []
      }
    })

    const allEventsArrays = await Promise.all(eventPromises)
    const totalConflicts = allEventsArrays.reduce((sum, events) => sum + events.length, 0)

    return {
      available: totalConflicts === 0,
      conflictCount: totalConflicts,
    }
  },
})
