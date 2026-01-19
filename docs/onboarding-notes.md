# Onboarding Flow Notes

Captures items to include in a future user onboarding experience. These are things that improve the product but require user input or setup.

## User Preferences

### Timezone (Priority: High)

- **Current state:** Settings → Account → Timezone dropdown
- **Why it matters:** Calendar events, reminders, and time-based features depend on correct timezone
- **Onboarding approach:**
  - Auto-detect browser timezone
  - Show confirmation: "It looks like you're in Eastern Time. Is that correct?"
  - Allow easy change if wrong

### Name/Display Name (Priority: Medium)

- **Current state:** Synced from Clerk auth
- **Why it matters:** Arlo uses it in responses
- **Onboarding approach:** Confirm the name from auth provider is what they want Arlo to call them

## Integrations

### Google Calendar (Priority: High)

- **Current state:** Settings → Integrations → Connect button
- **Why it matters:** Core feature for scheduling, availability, meeting management
- **Onboarding approach:**
  - Explain what Arlo can do with calendar access
  - One-click OAuth flow
  - Show success with sample of upcoming events

### Future Integrations

- Gmail (email triage, send on behalf)
- Slack (notifications, quick responses)
- Google Drive (document search, file management)
- Todoist/Asana (task sync for teams)

## Workspace Setup

### Projects & Folders (Priority: Medium)

- **Current state:** User creates manually via sidebar
- **Why it matters:** Organization affects how Arlo files tasks
- **Onboarding approach:**
  - Suggest common project structure: "Work", "Personal", "Home"
  - Ask about their organization style (flat vs. nested)
  - Arlo can help create initial structure

### Arlo Instructions (Priority: High)

- **Current state:** Not yet implemented
- **Why it matters:** Personalization makes Arlo more effective
- **Onboarding approach:**
  - Ask about communication style preference (brief vs. detailed)
  - Ask about work schedule (for proactive suggestions)
  - Ask about areas where they want Arlo's help most

## Technical Setup

### Notifications (Priority: Medium)

- **Current state:** Not implemented
- **Why it matters:** Reminders and proactive updates
- **Onboarding approach:**
  - Request notification permission
  - Let user choose notification types (reminders only, all updates, etc.)

### Mobile Access (Priority: Low)

- **Current state:** PWA support TBD
- **Why it matters:** Quick capture and on-the-go access
- **Onboarding approach:**
  - Prompt to add to home screen on mobile
  - Optional Telegram bot connection

## Onboarding Flow Design

### Principles

1. **Progressive disclosure** — Don't overwhelm on first visit
2. **Quick wins** — Get to value in < 2 minutes
3. **Skippable** — Every step can be done later
4. **Contextual** — Prompt for setup when relevant (e.g., calendar prompt when user asks about schedule)

### Suggested Flow

1. **Welcome** (5 seconds)
   - "Hi, I'm Arlo. I'll help you stay organized."

2. **Quick Setup** (30 seconds)
   - Timezone confirmation (auto-detected)
   - Name confirmation

3. **First Task** (30 seconds)
   - Prompt to create first task or try a natural language request

4. **Later Prompts** (contextual)
   - Calendar: When user mentions meetings/schedule
   - Projects: When user has 5+ tasks in Inbox
   - Notifications: After first reminder is set

## Implementation Notes

### Data to Collect During Onboarding

```typescript
interface OnboardingData {
  timezone: string // IANA timezone
  displayName?: string // Preferred name
  completedSteps: string[] // Track progress
  skippedSteps: string[] // Know what to prompt later
  integrationsConnected: string[]
  preferredCommunicationStyle?: 'brief' | 'detailed'
  workSchedule?: {
    startHour: number
    endHour: number
    workDays: number[] // 0=Sun, 1=Mon, etc.
  }
}
```

### Onboarding State

- Store in users table: `onboardingCompleted: boolean`, `onboardingData: object`
- Check on app load to show/hide onboarding
- Allow re-running from settings

## Open Questions

- [ ] Should onboarding be a separate route or modal overlay?
- [ ] How do we handle onboarding for returning users who haven't completed it?
- [ ] Should Arlo guide the onboarding conversationally?
