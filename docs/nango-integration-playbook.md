# Nango Integration Playbook

Guide for adding new third-party integrations via Nango.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Settings UI    │────▶│  Nango OAuth    │────▶│  Provider OAuth │
│  (Connect btn)  │     │  (Frontend SDK) │     │  (Google, etc)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                 │
                                 ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Arlo Tools     │────▶│  Calendar       │────▶│  Nango Proxy    │
│  (calendar.ts)  │     │  Actions        │     │  (API calls)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│  Integrations   │                             │  Provider API   │
│  Table (Convex) │                             │  (Google Cal)   │
└─────────────────┘                             └─────────────────┘
```

**Key principles:**

- Nango handles OAuth token lifecycle (refresh, storage, revocation)
- We store only `nangoConnectionId` in Convex, not tokens
- All API calls go through Nango's proxy (handles auth headers automatically)
- Webhooks notify us of token expiry/revocation

## Adding a New Integration

### 1. Nango Dashboard Setup

1. Log into [Nango Dashboard](https://app.nango.dev)
2. Create new integration:
   - Choose provider (e.g., "Google Calendar", "Gmail", "Slack")
   - Configure OAuth scopes needed
   - Note the `providerConfigKey` (e.g., `google-calendar`)
3. Get credentials:
   - `NANGO_SECRET_KEY` (if not already set)
   - Configure webhook URL: `https://<your-deployment>.convex.site/webhooks/nango`

### 2. Add Constants

In `convex/lib/integrationConstants.ts`:

```typescript
export const NEW_PROVIDER = 'provider-config-key' // from Nango dashboard

export const NEW_PROVIDER_SCOPES = [
  'https://www.googleapis.com/auth/scope1',
  'https://www.googleapis.com/auth/scope2',
]
```

### 3. Create Actions File

Create `convex/arlo/<provider>Actions.ts`:

```typescript
'use node'

import { v } from 'convex/values'
import { internalAction } from '../_generated/server'
import { getNangoClient } from '../lib/nango'
import { NEW_PROVIDER } from '../lib/integrationConstants'

// Default timezone for datetime operations (if applicable)
const DEFAULT_TIMEZONE = 'America/New_York'

export const someOperation = internalAction({
  args: {
    nangoConnectionId: v.string(),
    // ... other args
  },
  handler: async (_ctx, args) => {
    const nango = getNangoClient()

    const response = await nango.proxy({
      method: 'GET', // or POST, PATCH, DELETE
      endpoint: '/api/v1/resource',
      connectionId: args.nangoConnectionId,
      providerConfigKey: NEW_PROVIDER,
      params: {
        /* query params */
      },
      data: {
        /* body for POST/PATCH */
      },
    })

    return response.data
  },
})
```

### 4. Create Tools File

Create `convex/arlo/tools/<provider>.ts`:

```typescript
import { createTool } from '@convex-dev/agent'
import { z } from 'zod'
import { internal } from '../../_generated/api'
import { Id } from '../../_generated/dataModel'
import { NEW_PROVIDER } from '../../lib/integrationConstants'

function getUserId(ctx: { userId?: string }): Id<'users'> {
  if (!ctx.userId) {
    throw new Error('User context not available')
  }
  return ctx.userId as Id<'users'>
}

async function getProviderConnection(ctx: any, userId: Id<'users'>) {
  const integration = (await ctx.runQuery(internal.integrations.getByUserIdAndProvider, {
    userId,
    provider: NEW_PROVIDER,
  })) as { _id: Id<'integrations'>; nangoConnectionId: string; status: string } | null

  if (!integration) {
    return { error: 'Provider is not connected. Please connect it in Settings → Integrations.' }
  }

  if (integration.status !== 'active') {
    return {
      error: 'Provider connection has expired. Please reconnect in Settings → Integrations.',
    }
  }

  return { integration }
}

export const someTool = createTool({
  description: 'Description for the LLM',
  args: z.object({
    param: z.string().describe('Parameter description for the LLM'),
  }),
  handler: async (ctx, args) => {
    const userId = getUserId(ctx)
    const result = await getProviderConnection(ctx, userId)

    if ('error' in result) {
      return { success: false, error: result.error }
    }

    try {
      const response = await ctx.runAction(internal.arlo.providerActions.someOperation, {
        nangoConnectionId: result.integration.nangoConnectionId,
        // ... other args
      })

      await ctx.runMutation(internal.integrations.updateLastUsed, {
        integrationId: result.integration._id,
      })

      await ctx.runMutation(internal.activity.log, {
        userId,
        action: 'some_action',
        actor: 'arlo',
        outcome: 'success',
        details: 'Action description',
      })

      return { success: true, data: response }
    } catch (error) {
      console.error('Failed to perform action:', error)
      return { success: false, error: 'Failed to perform action' }
    }
  },
})
```

### 5. Register Tools with Agent

In `convex/arlo/agent.ts`:

```typescript
import { someTool, otherTool } from './tools/provider'

export const arlo = new Agent(components.agent, {
  // ...
  tools: {
    // ... existing tools
    someTool,
    otherTool,
  },
})
```

Update the agent's `instructions` to explain when to use the new tools.

### 6. Add to Settings UI

In `app/settings/integrations/page.tsx`, add to `AVAILABLE_INTEGRATIONS`:

```typescript
{
  provider: 'provider-config-key',
  name: 'Provider Name',
  description: 'What this integration does',
  icon: '🔌',
},
```

## Common Pitfalls

### 1. Missing Timezone in Datetime Fields

**Problem:** APIs like Google Calendar require timezone info with datetime values.

**Solution:** Always include `timeZone` when sending datetime:

```typescript
start: { dateTime: args.startTime, timeZone: DEFAULT_TIMEZONE }
```

### 2. Forgetting to Update `lastUsedAt`

**Problem:** Integration usage not tracked.

**Solution:** Call `updateLastUsed` after successful API calls:

```typescript
await ctx.runMutation(internal.integrations.updateLastUsed, {
  integrationId: result.integration._id,
})
```

### 3. Not Handling Expired/Revoked Connections

**Problem:** Tool fails silently when connection is bad.

**Solution:** Always check `integration.status` before making API calls:

```typescript
if (integration.status !== 'active') {
  return { error: 'Connection has expired...' }
}
```

### 4. Missing Error Context

**Problem:** Generic error messages make debugging hard.

**Solution:** Log the actual error and return user-friendly message:

```typescript
catch (error) {
  console.error('Failed to create event:', error)  // Full error in logs
  return { error: 'Failed to create event' }       // Clean message to user
}
```

### 5. Not Using `'use node'` Directive

**Problem:** Nango SDK requires Node.js runtime.

**Solution:** Add `'use node'` at top of actions files that use Nango:

```typescript
'use node'

import { Nango } from '@nangohq/node'
```

## Testing Checklist

Before considering an integration complete:

- [ ] OAuth flow works (connect/disconnect in Settings)
- [ ] Read operations work (e.g., list events)
- [ ] Write operations work (e.g., create event)
- [ ] Update operations work
- [ ] Delete operations work (with confirmation)
- [ ] Error messages are user-friendly
- [ ] Activity is logged for all operations
- [ ] `lastUsedAt` is updated
- [ ] Expired connection shows appropriate message
- [ ] Webhook handles token refresh errors

## Debugging

### Check Nango Dashboard

- View connection status
- See API call logs
- Check token validity

### Check Convex Logs

- Function execution logs
- Error stack traces
- API response details

### Common Errors

| Error            | Cause                  | Solution                               |
| ---------------- | ---------------------- | -------------------------------------- |
| 400 Bad Request  | Invalid request format | Check API docs, verify field formats   |
| 401 Unauthorized | Token expired/invalid  | Check Nango connection status          |
| 403 Forbidden    | Missing scopes         | Add required scopes in Nango dashboard |
| 404 Not Found    | Wrong endpoint         | Verify API endpoint path               |

## Future Improvements

- [ ] User-configurable timezone (store in users table)
- [ ] Retry logic for transient failures
- [ ] Rate limiting handling
- [ ] Batch operations support

---

## Testing Strategy

### Test Layers

```
┌─────────────────────────────────────────────────────┐
│           Manual E2E Tests (Arlo chat)              │
├─────────────────────────────────────────────────────┤
│        Integration Tests (Nango + real API)         │
├─────────────────────────────────────────────────────┤
│      Unit Tests (tools, actions with mocks)         │
└─────────────────────────────────────────────────────┘
```

### 1. Unit Tests for Calendar Actions

Test file: `__tests__/convex/arlo/calendarActions.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Nango client
vi.mock('@/convex/lib/nango', () => ({
  getNangoClient: vi.fn(() => ({
    proxy: vi.fn(),
  })),
  GOOGLE_CALENDAR_PROVIDER: 'google-calendar',
}))

describe('calendarActions', () => {
  describe('getEvents', () => {
    it('should include timezone in requests', async () => {
      // Test that datetime params include timezone
    })

    it('should map response to expected format', async () => {
      // Test response transformation
    })

    it('should handle empty events list', async () => {
      // Test edge case
    })
  })

  describe('createEvent', () => {
    it('should include timezone in start/end objects', async () => {
      // Verify the fix we just made
    })

    it('should handle optional attendees', async () => {
      // Test with and without attendees
    })
  })
})
```

### 2. Unit Tests for Calendar Tools

Test file: `__tests__/convex/arlo/tools/calendar.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('calendar tools', () => {
  describe('getCalendarConnection', () => {
    it('should return error if integration not found', async () => {
      const mockCtx = {
        runQuery: vi.fn().mockResolvedValue(null),
      }
      // Test error path
    })

    it('should return error if integration expired', async () => {
      const mockCtx = {
        runQuery: vi.fn().mockResolvedValue({ status: 'expired' }),
      }
      // Test expired status
    })

    it('should return integration if active', async () => {
      const mockCtx = {
        runQuery: vi.fn().mockResolvedValue({
          status: 'active',
          nangoConnectionId: 'test-id',
        }),
      }
      // Test happy path
    })
  })
})
```

### 3. Integration Tests (with real Nango)

For integration tests that hit real APIs, use a test calendar account.

Test file: `__tests__/integration/calendar.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Skip in CI unless INTEGRATION_TESTS=true
const runIntegrationTests = process.env.INTEGRATION_TESTS === 'true'

describe.skipIf(!runIntegrationTests)('Calendar Integration', () => {
  let testEventId: string

  it('should create an event', async () => {
    // Create real event in test calendar
    // Store eventId for cleanup
  })

  it('should retrieve events', async () => {
    // Verify created event appears in list
  })

  it('should update an event', async () => {
    // Update the test event
  })

  afterAll(async () => {
    // Clean up: delete test event
  })
})
```

### 4. Testing Tool Context

Tools receive a special `ctx` object. Mock it properly:

```typescript
function createMockToolContext(overrides = {}) {
  return {
    userId: 'test-user-id',
    runQuery: vi.fn(),
    runMutation: vi.fn(),
    runAction: vi.fn(),
    ...overrides,
  }
}

it('should pass userId to connection lookup', async () => {
  const ctx = createMockToolContext()
  await getCalendarEvents.handler(ctx, { startDate: '2024-01-01' })

  expect(ctx.runQuery).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'test-user-id' })
  )
})
```

### 5. Testing Nango Proxy Responses

Mock different API responses:

```typescript
const mockNango = {
  proxy: vi.fn(),
}

// Success case
mockNango.proxy.mockResolvedValue({
  data: { items: [{ id: '1', summary: 'Test Event' }] },
})

// Error cases
mockNango.proxy.mockRejectedValue(new Error('Request failed with status code 400'))
mockNango.proxy.mockRejectedValue(new Error('Request failed with status code 401'))
mockNango.proxy.mockRejectedValue(new Error('Request failed with status code 403'))
```

### Running Tests

```bash
# Unit tests (fast, no external deps)
pnpm test

# Single run
pnpm test:run

# With coverage
pnpm test:coverage

# Integration tests (requires real Nango connection)
INTEGRATION_TESTS=true pnpm test:run __tests__/integration/
```

### What to Test for Each Integration

| Layer       | What to Test                                       | How                         |
| ----------- | -------------------------------------------------- | --------------------------- |
| Actions     | Request format, response mapping                   | Unit test with mocked Nango |
| Tools       | Connection check, error handling, activity logging | Unit test with mocked ctx   |
| Integration | Full flow with real API                            | Integration test (optional) |
| E2E         | Arlo understands and uses tools correctly          | Manual test via chat        |

### Test Coverage Goals

- **Actions:** 80%+ coverage (all API calls, response mappings)
- **Tools:** 90%+ coverage (all error paths, happy paths)
- **Integration:** Smoke tests for critical paths only
