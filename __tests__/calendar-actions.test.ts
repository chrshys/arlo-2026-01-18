import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'

// Mock the nango module before importing calendarActions
vi.mock('../convex/lib/nango', () => ({
  getNangoClient: vi.fn(),
  GOOGLE_CALENDAR_PROVIDER: 'google-calendar',
}))

// Import after mocking
import { getNangoClient } from '../convex/lib/nango'

// We need to test the handlers directly, but they're Convex internal actions
// which are difficult to test in isolation. Instead, we'll test the logic
// by importing and calling the handler functions directly.

// Since calendarActions uses 'use node' directive and internalAction,
// we need to mock the Convex server module as well
vi.mock('../convex/_generated/server', () => ({
  internalAction: vi.fn((config: { handler: unknown }) => config),
}))

import * as calendarActions from '../convex/arlo/calendarActions'

// Type for mocked action structure (internalAction mock returns the config object)
type MockedAction<TArgs, TReturn> = {
  handler: (ctx: unknown, args: TArgs) => Promise<TReturn>
}

// Cast actions to access mocked handler
const getEvents = calendarActions.getEvents as unknown as MockedAction<
  {
    nangoConnectionId: string
    timeMin: string
    timeMax: string
    query?: string
    enabledCalendarIds?: string[]
  },
  {
    events: Array<{
      id: string
      title: string
      start?: string
      end?: string
      location?: string
      description?: string
      calendarId: string
      calendarName: string
    }>
  }
>

const createEvent = calendarActions.createEvent as unknown as MockedAction<
  {
    nangoConnectionId: string
    title: string
    startTime: string
    endTime: string
    description?: string
    location?: string
    attendees?: string[]
    timezone?: string
  },
  { eventId: string }
>

const updateEvent = calendarActions.updateEvent as unknown as MockedAction<
  {
    nangoConnectionId: string
    eventId: string
    title?: string
    startTime?: string
    endTime?: string
    description?: string
    location?: string
    timezone?: string
  },
  { success: boolean }
>

const deleteEvent = calendarActions.deleteEvent as unknown as MockedAction<
  { nangoConnectionId: string; eventId: string },
  { success: boolean }
>

const checkAvailability = calendarActions.checkAvailability as unknown as MockedAction<
  { nangoConnectionId: string; startTime: string; endTime: string; enabledCalendarIds?: string[] },
  { available: boolean; conflictCount: number }
>

describe('Calendar Actions', () => {
  let mockNangoProxy: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    mockNangoProxy = vi.fn()
    ;(getNangoClient as Mock).mockReturnValue({
      proxy: mockNangoProxy,
    })
  })

  describe('getEvents', () => {
    it('should fetch events from all calendars', async () => {
      // First call returns calendar list, second call returns events
      mockNangoProxy
        .mockResolvedValueOnce({
          data: {
            items: [
              { id: 'primary', summary: 'Primary Calendar', primary: true, accessRole: 'owner' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: 'event_1',
                summary: 'Team Meeting',
                start: { dateTime: '2024-01-15T10:00:00Z' },
                end: { dateTime: '2024-01-15T11:00:00Z' },
                location: 'Room A',
                description: 'Weekly sync',
              },
            ],
          },
        })

      const result = await getEvents.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          timeMin: '2024-01-15T00:00:00Z',
          timeMax: '2024-01-15T23:59:59Z',
        }
      )

      // Should first call calendarList
      expect(mockNangoProxy).toHaveBeenNthCalledWith(1, {
        method: 'GET',
        endpoint: '/calendar/v3/users/me/calendarList',
        connectionId: 'conn_123',
        providerConfigKey: 'google-calendar',
      })

      // Then call events for each calendar
      expect(mockNangoProxy).toHaveBeenNthCalledWith(2, {
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: 'conn_123',
        providerConfigKey: 'google-calendar',
        params: {
          timeMin: '2024-01-15T00:00:00Z',
          timeMax: '2024-01-15T23:59:59Z',
          singleEvents: 'true',
          orderBy: 'startTime',
        },
      })

      expect(result).toEqual({
        events: [
          {
            id: 'event_1',
            title: 'Team Meeting',
            start: '2024-01-15T10:00:00Z',
            end: '2024-01-15T11:00:00Z',
            location: 'Room A',
            description: 'Weekly sync',
            calendarId: 'primary',
            calendarName: 'Primary Calendar',
          },
        ],
      })
    })

    it('should include query parameter when provided', async () => {
      mockNangoProxy
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 'primary', summary: 'Primary', primary: true, accessRole: 'owner' }],
          },
        })
        .mockResolvedValueOnce({ data: { items: [] } })

      await getEvents.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          timeMin: '2024-01-15T00:00:00Z',
          timeMax: '2024-01-15T23:59:59Z',
          query: 'standup',
        }
      )

      // Second call (events) should include query param
      expect(mockNangoProxy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          params: expect.objectContaining({ q: 'standup' }),
        })
      )
    })

    it('should handle all-day events (date without time)', async () => {
      mockNangoProxy
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 'cal_1', summary: 'Holidays', primary: false, accessRole: 'reader' }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: 'event_1',
                summary: 'Holiday',
                start: { date: '2024-01-15' },
                end: { date: '2024-01-16' },
              },
            ],
          },
        })

      const result = await getEvents.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          timeMin: '2024-01-15T00:00:00Z',
          timeMax: '2024-01-15T23:59:59Z',
          enabledCalendarIds: ['cal_1'], // Enable the holidays calendar
        }
      )

      expect(result.events[0]).toEqual({
        id: 'event_1',
        title: 'Holiday',
        start: '2024-01-15',
        end: '2024-01-16',
        location: undefined,
        description: undefined,
        calendarId: 'cal_1',
        calendarName: 'Holidays',
      })
    })

    it('should return empty array when no events exist', async () => {
      mockNangoProxy.mockResolvedValueOnce({ data: { items: [] } }) // no calendars

      const result = await getEvents.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          timeMin: '2024-01-15T00:00:00Z',
          timeMax: '2024-01-15T23:59:59Z',
        }
      )

      expect(result).toEqual({ events: [] })
    })

    it('should only query enabled calendars when enabledCalendarIds is provided', async () => {
      // Return multiple calendars from the list
      mockNangoProxy
        .mockResolvedValueOnce({
          data: {
            items: [
              { id: 'primary', summary: 'Primary Calendar', primary: true, accessRole: 'owner' },
              { id: 'work', summary: 'Work Calendar', primary: false, accessRole: 'owner' },
              { id: 'family', summary: 'Family Calendar', primary: false, accessRole: 'owner' },
            ],
          },
        })
        // Only one calendar should be queried (primary)
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: 'event_1',
                summary: 'Primary Event',
                start: { dateTime: '2024-01-15T10:00:00Z' },
                end: { dateTime: '2024-01-15T11:00:00Z' },
              },
            ],
          },
        })

      const result = await getEvents.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          timeMin: '2024-01-15T00:00:00Z',
          timeMax: '2024-01-15T23:59:59Z',
          enabledCalendarIds: ['primary'], // Only primary enabled
        }
      )

      // Should only make 2 calls: calendarList + events for primary only
      expect(mockNangoProxy).toHaveBeenCalledTimes(2)

      // Should only have events from primary calendar
      expect(result.events).toHaveLength(1)
      expect(result.events[0].calendarId).toBe('primary')
    })

    it('should default to primary only when enabledCalendarIds is not provided', async () => {
      mockNangoProxy
        .mockResolvedValueOnce({
          data: {
            items: [
              { id: 'primary', summary: 'Primary', primary: true, accessRole: 'owner' },
              { id: 'other', summary: 'Other', primary: false, accessRole: 'owner' },
            ],
          },
        })
        .mockResolvedValueOnce({ data: { items: [] } })

      await getEvents.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          timeMin: '2024-01-15T00:00:00Z',
          timeMax: '2024-01-15T23:59:59Z',
          // No enabledCalendarIds provided - should default to ['primary']
        }
      )

      // Should only make 2 calls: calendarList + events for primary only
      expect(mockNangoProxy).toHaveBeenCalledTimes(2)
      expect(mockNangoProxy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          endpoint: '/calendar/v3/calendars/primary/events',
        })
      )
    })
  })

  describe('createEvent', () => {
    it('should call Nango proxy with correct parameters', async () => {
      mockNangoProxy.mockResolvedValue({ data: { id: 'new_event_123' } })

      const result = await createEvent.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          title: 'New Meeting',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
          description: 'Discuss roadmap',
          location: 'Room B',
          attendees: ['alice@example.com'],
          timezone: 'America/Los_Angeles',
        }
      )

      expect(mockNangoProxy).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: 'conn_123',
        providerConfigKey: 'google-calendar',
        data: {
          summary: 'New Meeting',
          start: { dateTime: '2024-01-15T10:00:00Z', timeZone: 'America/Los_Angeles' },
          end: { dateTime: '2024-01-15T11:00:00Z', timeZone: 'America/Los_Angeles' },
          description: 'Discuss roadmap',
          location: 'Room B',
          attendees: [{ email: 'alice@example.com' }],
        },
      })

      expect(result).toEqual({ eventId: 'new_event_123' })
    })

    it('should use default timezone when not provided', async () => {
      mockNangoProxy.mockResolvedValue({ data: { id: 'new_event_123' } })

      await createEvent.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          title: 'New Meeting',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
        }
      )

      expect(mockNangoProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start: { dateTime: '2024-01-15T10:00:00Z', timeZone: 'America/New_York' },
            end: { dateTime: '2024-01-15T11:00:00Z', timeZone: 'America/New_York' },
          }),
        })
      )
    })

    it('should handle events without optional fields', async () => {
      mockNangoProxy.mockResolvedValue({ data: { id: 'new_event_123' } })

      await createEvent.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          title: 'Quick Call',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T10:30:00Z',
        }
      )

      expect(mockNangoProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            summary: 'Quick Call',
            description: undefined,
            location: undefined,
            attendees: undefined,
          }),
        })
      )
    })

    it('should format multiple attendees correctly', async () => {
      mockNangoProxy.mockResolvedValue({ data: { id: 'new_event_123' } })

      await createEvent.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          title: 'Team Sync',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
          attendees: ['alice@example.com', 'bob@example.com', 'charlie@example.com'],
        }
      )

      expect(mockNangoProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attendees: [
              { email: 'alice@example.com' },
              { email: 'bob@example.com' },
              { email: 'charlie@example.com' },
            ],
          }),
        })
      )
    })
  })

  describe('updateEvent', () => {
    it('should call Nango proxy with PATCH method', async () => {
      mockNangoProxy.mockResolvedValue({ data: {} })

      const result = await updateEvent.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          eventId: 'event_123',
          title: 'Updated Title',
          startTime: '2024-01-15T14:00:00Z',
          endTime: '2024-01-15T15:00:00Z',
          description: 'New description',
          location: 'New Room',
          timezone: 'Europe/London',
        }
      )

      expect(mockNangoProxy).toHaveBeenCalledWith({
        method: 'PATCH',
        endpoint: '/calendar/v3/calendars/primary/events/event_123',
        connectionId: 'conn_123',
        providerConfigKey: 'google-calendar',
        data: {
          summary: 'Updated Title',
          start: { dateTime: '2024-01-15T14:00:00Z', timeZone: 'Europe/London' },
          end: { dateTime: '2024-01-15T15:00:00Z', timeZone: 'Europe/London' },
          description: 'New description',
          location: 'New Room',
        },
      })

      expect(result).toEqual({ success: true })
    })

    it('should only include provided fields in update', async () => {
      mockNangoProxy.mockResolvedValue({ data: {} })

      await updateEvent.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          eventId: 'event_123',
          title: 'Only Title Update',
        }
      )

      expect(mockNangoProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { summary: 'Only Title Update' },
        })
      )
    })

    it('should use default timezone when not provided', async () => {
      mockNangoProxy.mockResolvedValue({ data: {} })

      await updateEvent.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          eventId: 'event_123',
          startTime: '2024-01-15T14:00:00Z',
        }
      )

      expect(mockNangoProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            start: { dateTime: '2024-01-15T14:00:00Z', timeZone: 'America/New_York' },
          },
        })
      )
    })
  })

  describe('deleteEvent', () => {
    it('should call Nango proxy with DELETE method', async () => {
      mockNangoProxy.mockResolvedValue({ data: {} })

      const result = await deleteEvent.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          eventId: 'event_to_delete',
        }
      )

      expect(mockNangoProxy).toHaveBeenCalledWith({
        method: 'DELETE',
        endpoint: '/calendar/v3/calendars/primary/events/event_to_delete',
        connectionId: 'conn_123',
        providerConfigKey: 'google-calendar',
      })

      expect(result).toEqual({ success: true })
    })
  })

  describe('checkAvailability', () => {
    it('should return available when no events exist', async () => {
      mockNangoProxy
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 'primary', summary: 'Primary', primary: true, accessRole: 'owner' }],
          },
        })
        .mockResolvedValueOnce({ data: { items: [] } })

      const result = await checkAvailability.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
        }
      )

      expect(result).toEqual({ available: true, conflictCount: 0 })
    })

    it('should return unavailable with conflict count across enabled calendars', async () => {
      mockNangoProxy
        .mockResolvedValueOnce({
          data: {
            items: [
              { id: 'primary', summary: 'Primary', primary: true, accessRole: 'owner' },
              { id: 'family', summary: 'Family', primary: false, accessRole: 'writer' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: { items: [{ id: 'conflict_1' }] },
        })
        .mockResolvedValueOnce({
          data: { items: [{ id: 'conflict_2' }] },
        })

      const result = await checkAvailability.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
          enabledCalendarIds: ['primary', 'family'], // Enable both calendars
        }
      )

      expect(result).toEqual({ available: false, conflictCount: 2 })
    })

    it('should call Nango proxy for each calendar with singleEvents parameter', async () => {
      mockNangoProxy
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 'primary', summary: 'Primary', primary: true, accessRole: 'owner' }],
          },
        })
        .mockResolvedValueOnce({ data: {} })

      await checkAvailability.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
        }
      )

      // First call is calendarList
      expect(mockNangoProxy).toHaveBeenNthCalledWith(1, {
        method: 'GET',
        endpoint: '/calendar/v3/users/me/calendarList',
        connectionId: 'conn_123',
        providerConfigKey: 'google-calendar',
      })

      // Second call is events for primary calendar
      expect(mockNangoProxy).toHaveBeenNthCalledWith(2, {
        method: 'GET',
        endpoint: '/calendar/v3/calendars/primary/events',
        connectionId: 'conn_123',
        providerConfigKey: 'google-calendar',
        params: {
          timeMin: '2024-01-15T10:00:00Z',
          timeMax: '2024-01-15T11:00:00Z',
          singleEvents: 'true',
        },
      })
    })

    it('should handle missing items array', async () => {
      mockNangoProxy.mockResolvedValueOnce({ data: { items: [] } }) // no calendars

      const result = await checkAvailability.handler(
        {},
        {
          nangoConnectionId: 'conn_123',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
        }
      )

      expect(result).toEqual({ available: true, conflictCount: 0 })
    })
  })
})
