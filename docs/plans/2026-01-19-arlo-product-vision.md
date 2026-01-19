# Arlo Product Vision

> Refined product direction incorporating learnings from clawdbot architecture analysis
> January 19, 2026

---

## The Core Thesis

**Arlo is a chief of staff, not a task app.**

Most productivity tools assume you're a reliable executor. Create task → do task. But humans:

- Create tasks they'll never do
- Avoid tasks because they're too big or unclear
- Let lists grow until they're overwhelming and abandoned
- Context-switch constantly and lose track of priorities

A chief of staff doesn't just track. They:

- Push back: "This has been here 3 weeks. Are you actually doing this?"
- Clarify: "This is too vague. What's the actual next step?"
- Act: "I handled this for you. Here's what I did."
- Prioritize: "You have 47 tasks. Let's be honest about which 10 matter."

**The product bet:** An AI with permission to push back and take action—not just track—changes how people get things done.

---

## What Makes Arlo Different

| Generic AI Assistant    | Arlo                  |
| ----------------------- | --------------------- |
| Answers questions       | Manages your work     |
| Waits for prompts       | Proactively checks in |
| Stateless conversations | Remembers everything  |
| Politely helpful        | Honestly direct       |
| Suggests actions        | Actually does things  |
| Generic personality     | Knows YOUR context    |

The differentiator isn't the tools—it's the **relationship**. Arlo has context, continuity, and permission to be honest.

---

## The Three Pillars

### 1. Shared Workspace

Arlo and the user share a task and notes system. Both can read and write. This creates:

- **Transparency**: User sees everything Arlo does
- **Context**: Arlo understands ongoing work
- **Trust**: No hidden state, no magic

### 2. Proactive Behaviors

Arlo doesn't wait to be asked. Scheduled jobs drive:

- Morning briefings
- Task grooming and pushback
- Meeting preparation
- End-of-day summaries
- Weekly reviews

The daily check-in is the heartbeat. It's where trust gets built or broken.

### 3. Skills & Integrations

Arlo's capabilities expand through:

- **Skills**: Modular knowledge and behaviors (always available)
- **Integrations**: External service connections (user-enabled)
- **Tools**: Atomic actions Arlo can take

Skills tell Arlo _how_ to do things. Integrations give Arlo _access_ to things. Tools are the _actions_ Arlo takes.

---

## A Day in the Life

### Morning (7:30 AM)

Arlo's morning job runs automatically:

```
Good morning Chris.

TODAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 2 meetings: Standup (9am), Design review (2pm)
• 3 tasks due: Finish Q1 report, Review PR #234, Call dentist
• 2 unread emails marked urgent (from Sarah)

OBSERVATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Finish Q1 report" has been on your list for 11 days.
It's due today. Is this actually happening, or should we
push it and be honest about that?

Tomorrow is packed (4 meetings). Anything that can move?

What's your #1 priority today?
```

### Throughout the Day

**11:30 AM** - Email arrives from Sarah about budget review

Arlo (with email integration):

```
Sarah needs you to review the budget doc before 3pm.

I've created a task and linked the Google Drive file.
You have a 2-hour gap from 12-2pm—good time to handle this.
```

**2:45 PM** - Before design review

Arlo:

```
Design review in 15 minutes.

Related context I found:
• Your "Design Review Prep" note (edited 3 days ago)
• Unfinished task: "Finalize color palette" (overdue)
• Lisa's Slack message about nav feedback (unread)

Want me to pull these into a quick briefing doc?
```

### Evening (6:00 PM)

```
END OF DAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Completed: 5 tasks
Rolling to tomorrow: 3 tasks

The budget review is still open—Sarah might follow up.
The Q1 report got pushed again. That's 12 days now.

Anything you want to capture before tomorrow?
```

### Weekly (Sunday 7 PM)

```
WEEKLY REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Created: 14 tasks
Completed: 9 tasks
Stale (7+ days untouched): 3 tasks

STALE TASKS
• "Learn Rust basics" — 21 days, zero progress
• "Research vacation spots" — 14 days
• "Call mom" — 9 days

I'll be direct: "Learn Rust basics" isn't happening.
Either delete it, make it tiny, or schedule dedicated time.
Which one?
```

---

## Skills System

### What Skills Are

Skills are modular knowledge packs that extend Arlo's capabilities. Each skill contains:

- **Instructions**: How Arlo should behave in this domain
- **Tools**: Actions Arlo can take
- **Triggers**: When the skill activates

Skills use **progressive disclosure**: only the name and description are always in context. Full instructions load when relevant.

### Skill Categories

#### Core Skills (Always Active)

| Skill             | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `task-management` | Create, organize, prioritize, complete, groom tasks |
| `notes`           | Create, search, update documents                    |
| `daily-briefing`  | Morning check-ins, end-of-day summaries             |
| `weekly-review`   | Task grooming, honest pushback, reflection          |
| `chief-of-staff`  | Personality, directness, proactive behaviors        |

#### Integration Skills (User-Enabled)

| Skill             | Requires         | Enables                                       |
| ----------------- | ---------------- | --------------------------------------------- |
| `google-calendar` | Nango connection | Read/write calendar, availability, scheduling |
| `gmail`           | Nango connection | Read, search, draft, send (with approval)     |
| `google-drive`    | Nango connection | Search, read, organize files                  |
| `slack`           | Nango connection | Read channels, post messages (with approval)  |
| `github`          | Nango connection | PR status, issues, notifications              |
| `notion`          | Nango connection | Sync external workspace                       |
| `linear`          | Nango connection | Issue tracking, project status                |

#### Specialized Skills (User-Configurable)

| Skill              | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `meeting-prep`     | Auto-gather context before calendar events |
| `email-triage`     | Categorize inbox, extract action items     |
| `project-tracker`  | Status reports across projects             |
| `travel-assistant` | Trip planning, packing lists, itineraries  |
| `research-mode`    | Deep dives with web search, summarization  |

### Skill Definition Format

```
skills/<skill-name>/
├── SKILL.md           # Name, description, full instructions
├── tools/             # Tool definitions (optional)
└── prompts/           # Prompt templates (optional)
```

Example `SKILL.md`:

```markdown
---
name: meeting-prep
description: Prepare briefings before calendar events
triggers:
  - 15 minutes before any meeting
  - User asks about upcoming meeting
requires:
  - google-calendar
  - notes (optional)
  - slack (optional)
---

# Meeting Prep

When preparing for a meeting:

1. Get meeting details (attendees, agenda, location)
2. Search notes for related documents
3. Check for incomplete tasks related to meeting topic
4. If Slack connected, find recent relevant messages
5. Compile into a brief summary

Offer to create a preparation checklist if meeting is important.
```

---

## Integrations Architecture

### How Integrations Work

```
┌─────────────────────────────────────────────────────────┐
│                         ARLO                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Skill     │  │   Skill     │  │   Skill     │     │
│  │  (gmail)    │  │ (calendar)  │  │  (slack)    │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          │                              │
│                   ┌──────▼──────┐                       │
│                   │   Tools     │                       │
│                   │  (actions)  │                       │
│                   └──────┬──────┘                       │
└──────────────────────────┼──────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Nango     │
                    │   (proxy)   │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐        ┌────▼────┐
   │  Gmail  │       │ Calendar│        │  Slack  │
   └─────────┘       └─────────┘        └─────────┘
```

### Integration Status Model

```typescript
integrations: {
  userId: Id<'users'>
  provider: string              // 'google-calendar', 'gmail', 'slack'
  nangoConnectionId: string     // Nango's reference
  status: 'active' | 'expired' | 'revoked'
  scopes: string[]              // What permissions granted
  connectedAt: number
  lastUsedAt: number
  metadata: Record<string, any> // Provider-specific data
}
```

### Integration Roadmap

| Phase | Integration     | Priority | Value                      |
| ----- | --------------- | -------- | -------------------------- |
| Done  | Google Calendar | P0       | Schedule awareness         |
| 1     | Gmail           | P0       | Email → tasks, context     |
| 1     | Google Drive    | P1       | File context, attachments  |
| 2     | Slack           | P1       | Work communication context |
| 2     | GitHub          | P2       | Developer workflow         |
| 3     | Notion          | P2       | External workspace sync    |
| 3     | Linear          | P2       | Issue tracking             |
| 4     | Todoist         | P3       | Migration path             |
| 4     | Apple Reminders | P3       | iOS integration            |

---

## Proactive Behaviors (Cron Jobs)

### Scheduled Jobs

| Job                | Schedule             | What It Does                                   |
| ------------------ | -------------------- | ---------------------------------------------- |
| `morning-briefing` | 7:30 AM local        | Today's calendar, due tasks, observations      |
| `meeting-prep`     | 15 min before events | Gather context, surface related items          |
| `end-of-day`       | 6:00 PM local        | Summary, incomplete items, tomorrow preview    |
| `weekly-review`    | Sunday 7 PM local    | Task grooming, stale item pushback             |
| `task-grooming`    | Daily 10 AM          | Flag items stale 7+ days                       |
| `email-digest`     | 8 AM, 2 PM local     | Surface action items from email (if connected) |

### Job Implementation Pattern

```typescript
// convex/arlo/scheduler.ts
const crons = cronJobs()

crons.daily(
  'morning-briefing',
  { hourUTC: 12, minuteUTC: 30 }, // Adjusted per user timezone
  internal.arlo.scheduler.morningBriefing
)

// The job itself
export const morningBriefing = internalAction({
  handler: async (ctx) => {
    // For each user with notifications enabled:
    // 1. Get today's calendar events
    // 2. Get tasks due today/overdue
    // 3. Get recent activity
    // 4. Check for stale items
    // 5. Generate briefing via agent
    // 6. Deliver (push notification, email, or save to inbox)
  },
})
```

### Notification Delivery

Users configure how they receive proactive messages:

| Channel  | Implementation                  | Use Case                  |
| -------- | ------------------------------- | ------------------------- |
| In-app   | Save to dedicated "Arlo" thread | Default, always available |
| Push     | Web push notification           | Time-sensitive alerts     |
| Email    | Transactional email             | Daily digests             |
| Telegram | Bot message (future)            | Mobile-first users        |

---

## User Configuration

### Visible AI Settings

Users see and control the machinery:

```
ARLO SETTINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ABOUT YOU
────────────────────────────────────────────
Name: Chris
Timezone: America/New_York
Working hours: 9am - 6pm

PERSONALITY
────────────────────────────────────────────
Communication style: [Direct] Supportive / Neutral
Proactiveness: [High] Low / Medium
Check-in frequency: [Daily] None / Weekly

INSTRUCTIONS
────────────────────────────────────────────
"I work at Acme Corp. My manager is Sarah.
I prefer morning focus time—don't schedule
meetings before 10am if possible.
Birthdays are important to me—always remind
me a week before family birthdays."

SKILLS
────────────────────────────────────────────
☑ Task Management
☑ Daily Briefings
☑ Calendar (connected)
☐ Gmail (not connected) [Connect]
☐ Slack (not connected) [Connect]
☐ Meeting Prep (requires Calendar)
☐ Email Triage (requires Gmail)

ACTIVITY LOG
────────────────────────────────────────────
Today
• 9:15 AM - Created task "Review budget doc"
• 9:15 AM - Linked Google Drive file to task
• 7:30 AM - Sent morning briefing

Yesterday
• 6:00 PM - Sent end-of-day summary
• 2:45 PM - Sent meeting prep for Design Review
...
```

### Data Model for Configuration

```typescript
userSettings: {
  userId: Id<'users'>

  // Profile
  displayName: string
  timezone: string
  workingHours: { start: string, end: string }

  // Personality
  communicationStyle: 'direct' | 'supportive' | 'neutral'
  proactiveness: 'low' | 'medium' | 'high'
  checkInFrequency: 'none' | 'daily' | 'weekly'

  // Custom instructions (the user's CLAUDE.md equivalent)
  instructions: string

  // Notification preferences
  notifications: {
    inApp: boolean
    push: boolean
    email: boolean
    digestTime: string  // "07:30"
  }
}

userSkills: {
  userId: Id<'users'>
  skillId: string
  enabled: boolean
  config: Record<string, any>  // Skill-specific settings
}
```

---

## Autonomy Levels

### What Arlo Can Do Autonomously

| Action                               | Autonomous | Needs Approval |
| ------------------------------------ | ---------- | -------------- |
| Read calendar                        | ✅         |                |
| Read emails                          | ✅         |                |
| Read Slack messages                  | ✅         |                |
| Search files                         | ✅         |                |
| Create tasks                         | ✅         |                |
| Complete tasks                       | ✅         |                |
| Create notes                         | ✅         |                |
| Create calendar events (personal)    | ✅         |                |
| Create calendar events (with others) |            | ✅             |
| Draft emails                         | ✅         |                |
| **Send emails**                      |            | ✅ Always      |
| **Post to Slack**                    |            | ✅ Always      |
| **Delete anything**                  |            | ✅ Always      |
| Move/organize items                  | ✅         |                |

### The Approval Pattern

For actions requiring approval:

```
I've drafted an email to Dr. Smith's office to reschedule
your appointment:

────────────────────────────────────────────
To: appointments@smithdental.com
Subject: Reschedule appointment - Chris Hayes

Hi, I need to reschedule my January 25th 10am
appointment. I'm available:
- Monday 1/27 at 2pm
- Wednesday 1/29 at 10am or 3pm

Please let me know what works.

Thanks,
Chris
────────────────────────────────────────────

[Send] [Edit] [Cancel]
```

---

## Technical Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────┐
│                        FRONTEND                            │
│  Next.js + React                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Chat    │ │  Tasks   │ │  Notes   │ │ Settings │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
└───────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                           │
┌──────────────────────────┼─────────────────────────────────┐
│                       CONVEX                               │
│                          │                                 │
│  ┌───────────────────────▼────────────────────────────┐   │
│  │                    Agent                            │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  │  │ Skills  │ │  Tools  │ │ Context │ │ Memory  │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                 │
│  ┌───────────────────────┼────────────────────────────┐   │
│  │              Scheduled Jobs (Cron)                  │   │
│  │  morning-briefing │ meeting-prep │ weekly-review   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                 │
│  ┌───────────────────────▼────────────────────────────┐   │
│  │                   Database                          │   │
│  │  users │ tasks │ notes │ activity │ integrations   │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬─────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │    Nango    │
                    │  (OAuth +   │
                    │   Proxy)    │
                    └──────┬──────┘
                           │
        ┌─────────┬────────┼────────┬─────────┐
        ▼         ▼        ▼        ▼         ▼
     Google    Google    Slack   GitHub    Linear
     Calendar   Gmail
```

### Key Technical Decisions

| Decision        | Choice                | Rationale                                |
| --------------- | --------------------- | ---------------------------------------- |
| Backend         | Convex                | Real-time, serverless, agent SDK         |
| Agent Framework | @convex-dev/agent     | Native Convex integration                |
| OAuth/API Proxy | Nango                 | Handles token refresh, unified interface |
| Frontend        | Next.js               | Vercel deployment, React ecosystem       |
| Scheduling      | Convex cron           | Native, no external service              |
| Model           | Claude via AI Gateway | Best reasoning, tool use                 |

---

## Roadmap

### Phase 1: Proactive Foundation (Current → 2 weeks)

**Goal:** Arlo initiates, not just responds.

| Item               | Type        | Description                          |
| ------------------ | ----------- | ------------------------------------ |
| Morning briefing   | Cron job    | Daily check-in with calendar + tasks |
| End-of-day summary | Cron job    | What happened, what's rolling        |
| User timezone      | Schema + UI | Per-user scheduling                  |
| User instructions  | Schema + UI | Editable context (their CLAUDE.md)   |
| Activity log UI    | Frontend    | Visible Arlo actions                 |

**Success metric:** Users receive and respond to daily briefings.

### Phase 2: Email Integration (2 weeks)

**Goal:** Arlo understands your communication.

| Item                    | Type        | Description                 |
| ----------------------- | ----------- | --------------------------- |
| Gmail Nango provider    | Integration | OAuth setup                 |
| `getEmails` tool        | Tool        | Search and read emails      |
| `draftEmail` tool       | Tool        | Create drafts               |
| `sendEmail` tool        | Tool        | Send with approval          |
| Email → task extraction | Skill       | Surface action items        |
| Email digest            | Cron job    | Morning/afternoon summaries |

**Success metric:** Arlo creates tasks from emails without being asked.

### Phase 3: Skills System (2-3 weeks)

**Goal:** Modular, extensible capabilities.

| Item                  | Type     | Description                       |
| --------------------- | -------- | --------------------------------- |
| Skill schema          | Database | Store skill definitions           |
| Skill loader          | Runtime  | Progressive disclosure            |
| Core skills           | Content  | task-management, notes, briefings |
| Skill settings UI     | Frontend | Enable/disable, configure         |
| `meeting-prep` skill  | Skill    | Pre-meeting context gathering     |
| `weekly-review` skill | Skill    | Sunday task grooming              |

**Success metric:** Users can enable/disable skills and see the difference.

### Phase 4: Broader Integrations (3-4 weeks)

**Goal:** Arlo sees your work context.

| Item                    | Type        | Description              |
| ----------------------- | ----------- | ------------------------ |
| Google Drive            | Integration | File search and context  |
| Slack                   | Integration | Channel reading, posting |
| GitHub                  | Integration | PR/issue awareness       |
| `project-tracker` skill | Skill       | Cross-source status      |

**Success metric:** Arlo references Slack/GitHub context unprompted.

### Phase 5: Polish & Trust (Ongoing)

**Goal:** Arlo feels like a trusted partner.

| Item                  | Type    | Description                  |
| --------------------- | ------- | ---------------------------- |
| Approval workflows    | UX      | Clean send/edit/cancel flows |
| Undo actions          | Feature | Revert Arlo's changes        |
| Confidence indicators | UX      | "I'm not sure about this"    |
| Feedback loops        | Feature | "Was this helpful?"          |
| Custom skills         | Feature | User-created skills          |

**Success metric:** Users trust Arlo to take action without micromanaging.

---

## Success Criteria

### Product-Market Fit Signals

1. **Daily engagement**: Users interact with Arlo most days
2. **Proactive value**: Users respond to briefings, not just initiate
3. **Task completion**: Completion rate improves over time
4. **Trust growth**: Users enable more integrations over time
5. **Honest feedback**: Users appreciate (not resent) pushback

### What We're Testing

| Hypothesis                        | How We'll Know                         |
| --------------------------------- | -------------------------------------- |
| Proactive check-ins are valuable  | Users read and respond to briefings    |
| Honest pushback helps             | Users delete stale tasks when prompted |
| Chief of staff metaphor resonates | Users describe Arlo this way           |
| Visible AI config builds trust    | Users edit their instructions          |
| Doing things > suggesting things  | Users approve Arlo's actions           |

### What Would Kill This

- Users ignore proactive messages (wrong channel/timing)
- Pushback feels annoying, not helpful (wrong tone)
- Integration friction too high (OAuth fatigue)
- AI mistakes erode trust (wrong actions)
- Not enough value over simpler tools (Things 3, Todoist)

---

## Open Questions

1. **Notification channel**: In-app vs push vs email vs Telegram? Start with one.

2. **Multi-user**: Is this personal-only or will teams matter? Defer for now.

3. **Mobile**: Web-first or native app? Web-first, revisit after validation.

4. **Voice**: Voice input/output? Interesting but not core. Defer.

5. **Pricing**: Free tier limits? Per-integration pricing? Figure out after value is proven.

6. **Skill marketplace**: User-created skills? Community sharing? Future if core works.

---

## Appendix: Clawdbot Learnings

Key patterns adopted from clawdbot architecture analysis:

| Pattern        | Clawdbot                          | Arlo Adaptation                |
| -------------- | --------------------------------- | ------------------------------ |
| Skills system  | SKILL.md + progressive loading    | Similar, stored in DB          |
| Tool policies  | Profiles (minimal/full)           | Integration-based availability |
| Cron service   | Full job scheduler                | Convex native cron             |
| User workspace | Markdown files (USER.md, SOUL.md) | Database + UI settings         |
| Session memory | Vector embeddings                 | Convex thread history          |
| Multi-channel  | 10+ messaging platforms           | Start with in-app, add later   |

**Not adopting:**

- CLI-based integrations (we use Nango for product-grade OAuth)
- Local-first architecture (we're serverless/cloud-native)
- Bash tool execution (we use structured Convex actions)

---

## Appendix: Life Context (Speculative)

> **Status: Ideation** — This section captures speculative thinking about expanding Arlo beyond work context. Not yet confirmed as part of the roadmap, but worth exploring.

### The Insight

A chief of staff who only knows about work is half-blind. Real life isn't compartmentalized:

- The reason you can't take that 4pm meeting is pickup day
- The reason Friday is bad for travel is the soccer tournament
- The stress isn't the deadline—it's that it coincides with your kid's doctor appointment

A real chief of staff knows your whole life. Should Arlo?

### What "Life Context" Could Include

**Family structure:**

- Spouse/partner: name, work situation (flexible? travels?)
- Children: names, ages, schools, activities
- Pets: names, vet schedules
- Extended family that matters (aging parents, etc.)

**Recurring commitments:**

- Kids' activities: "Soccer Tue/Thu 4-5:30pm, games Saturdays"
- Household rhythms: "Meal prep Sundays, groceries Saturdays"
- School logistics: "Pickup Mon/Wed/Fri, Sarah does Tue/Thu"
- Protected time: "Family dinner 6-7pm is sacred"

**Shared calendars:**

- Partner's work calendar
- Family shared calendar
- School calendars
- Sports team schedules

### What This Would Enable

**Scheduling intelligence:**

```
You're trying to schedule a work trip Feb 12-14.

Heads up:
- Feb 13 is Emma's school play (she's been practicing for weeks)
- Feb 14 is Valentine's Day

Still want me to look at flights?
```

**Proactive coordination:**

```
TOMORROW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Work: Design review at 2pm
Family: Jake's soccer game at 5:30pm

You have pickup. Sarah has a conflict until 5pm.
You'll need to leave by 4:45 to make it.

Want me to block 4:30-5:30 on your work calendar?
```

**Household awareness:**

```
Jake's annual physical is due (last one was 11 months ago).
Emma's soccer registration opens next week.
Max is due for his vet checkup in March.

Want me to create tasks for these?
```

### Context Modes

Different users want different levels:

| Mode         | Description                                             |
| ------------ | ------------------------------------------------------- |
| Work only    | Work calendar, work tasks, professional context         |
| Life only    | Family calendar, household tasks (stay-at-home parents) |
| Full context | Both—help me balance everything                         |

### Speculative Data Model

```typescript
lifeContext: {
  userId: Id<'users'>

  household: {
    partner?: {
      name: string
      calendarEmail?: string
      workStyle?: 'flexible' | 'fixed' | 'travels'
    }
    children?: Array<{
      name: string
      age: number
      school?: string
      activities: Array<{ name: string, schedule: string }>
    }>
    pets?: Array<{
      name: string
      type: string
      vetDue?: string
    }>
  }

  recurringCommitments: Array<{
    name: string
    schedule: string
    owner: 'me' | 'partner' | 'shared'
    protected: boolean
  }>

  sharedCalendars: Array<{
    name: string
    email: string
    type: 'partner' | 'family' | 'school' | 'sports'
  }>
}
```

### Privacy Considerations

This is intimate data. Principles if we pursue this:

1. **Opt-in only** — Life context empty by default
2. **Granular control** — Share "I have kids" without names/ages
3. **No inference creep** — Don't guess family details from emails
4. **Clear boundaries** — Family data never leaves system
5. **Partner awareness** — If syncing partner's calendar, they should know

### Open Questions

- Is this "life OS" vision too ambitious for MVP?
- Would this dilute the work-focused value prop?
- How do we handle shared family accounts (both parents use Arlo)?
- What's the right UI for entering this context without being tedious?
- Does this require different integrations (Apple Calendar, shared family calendars)?

### The Bigger Picture

This would move Arlo from "productivity tool" to "life operating system." The chief of staff metaphor actually works _better_ with full life context—that's what real chiefs of staff know.

But it's a bigger bet. Parking here for now.

---

## Next Steps

1. **Implement morning briefing** - The fastest way to feel if proactive has legs
2. **Add user instructions field** - Let users shape Arlo's context
3. **Build activity log UI** - Make Arlo's actions visible
4. **Spec Gmail integration** - Highest-value next integration

The daily check-in is the heartbeat. Start there.
