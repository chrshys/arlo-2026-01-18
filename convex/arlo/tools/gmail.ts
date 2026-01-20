import { internal } from '../../_generated/api'
import { Id } from '../../_generated/dataModel'
import { GMAIL_PROVIDER } from '../../lib/integrationConstants'

// Exported for testing
export function getUserId(ctx: { userId?: string }): Id<'users'> {
  if (!ctx.userId) {
    throw new Error('User context not available')
  }
  return ctx.userId as Id<'users'>
}

export type GmailConnectionResult =
  | { error: string }
  | {
      integration: {
        _id: Id<'integrations'>
        nangoConnectionId: string
        status: string
        gmailPermissionLevel?: 'read' | 'read_draft' | 'read_draft_send'
        gmailRequireConfirmation?: boolean
      }
    }

// Get Gmail connection and check permissions
export async function getGmailConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userId: Id<'users'>,
  requiredLevel?: 'read' | 'read_draft' | 'read_draft_send'
): Promise<GmailConnectionResult> {
  const integration = (await ctx.runQuery(internal.integrations.getByUserIdAndProvider, {
    userId,
    provider: GMAIL_PROVIDER,
  })) as {
    _id: Id<'integrations'>
    nangoConnectionId: string
    status: string
    gmailPermissionLevel?: 'read' | 'read_draft' | 'read_draft_send'
    gmailRequireConfirmation?: boolean
  } | null

  if (!integration) {
    return {
      error: 'Gmail is not connected. Please connect it in Settings → Integrations.',
    }
  }

  if (integration.status !== 'active') {
    return {
      error: 'Gmail connection has expired. Please reconnect in Settings → Integrations.',
    }
  }

  // Check permission level if required
  if (requiredLevel) {
    const level = integration.gmailPermissionLevel || 'read_draft'
    const levels = ['read', 'read_draft', 'read_draft_send']
    const currentIndex = levels.indexOf(level)
    const requiredIndex = levels.indexOf(requiredLevel)

    if (currentIndex < requiredIndex) {
      const levelNames: Record<string, string> = {
        read: 'Read-only',
        read_draft: 'Read + Draft',
        read_draft_send: 'Read + Draft + Send',
      }
      return {
        error: `This action requires "${levelNames[requiredLevel]}" permission. Current level: "${levelNames[level]}". Update in Settings → Integrations.`,
      }
    }
  }

  return { integration }
}

// Check if send requires confirmation
export function requiresSendConfirmation(integration: {
  gmailPermissionLevel?: 'read' | 'read_draft' | 'read_draft_send'
  gmailRequireConfirmation?: boolean
}): boolean {
  if (integration.gmailPermissionLevel !== 'read_draft_send') {
    return true // Can't send without permission anyway
  }
  return integration.gmailRequireConfirmation !== false // Default to true
}
