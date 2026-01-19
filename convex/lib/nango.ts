'use node'

import { Nango } from '@nangohq/node'

// Re-export constants for convenience
export { GOOGLE_CALENDAR_PROVIDER, GOOGLE_CALENDAR_SCOPES } from './integrationConstants'

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
