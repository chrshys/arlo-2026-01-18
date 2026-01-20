/**
 * Date/time utilities for Arlo agent context injection
 */

/**
 * Format the current date/time in a human-readable format
 * Similar to clawdbot's formatUserTime
 */
export function formatUserTime(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const parts = formatter.formatToParts(date)
  const partMap: Record<string, string> = {}
  for (const part of parts) {
    partMap[part.type] = part.value
  }

  // Add ordinal suffix to day
  const day = parseInt(partMap.day, 10)
  const ordinal = getOrdinalSuffix(day)

  return `${partMap.weekday}, ${partMap.month} ${day}${ordinal}, ${partMap.year} at ${partMap.hour}:${partMap.minute} ${partMap.dayPeriod}`
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
