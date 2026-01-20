// Integration provider constants (no Node.js dependencies)

export const GOOGLE_CALENDAR_PROVIDER = 'google-calendar'

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
]

export const GMAIL_PROVIDER = 'gmail'

// Scopes for each permission level
export const GMAIL_SCOPES_READ = ['https://www.googleapis.com/auth/gmail.readonly']

export const GMAIL_SCOPES_READ_DRAFT = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
]

export const GMAIL_SCOPES_FULL = ['https://www.googleapis.com/auth/gmail.modify']
