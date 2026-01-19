import { Nango } from '@nangohq/node'

let nangoClient: Nango | null = null

export function getNangoClient(): Nango {
  if (!nangoClient) {
    const secretKey = process.env.NANGO_SECRET_KEY
    if (!secretKey) {
      throw new Error('NANGO_SECRET_KEY environment variable is not set')
    }
    nangoClient = new Nango({ secretKey })
  }
  return nangoClient
}

export const GOOGLE_CALENDAR_PROVIDER = 'google-calendar'

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
]
