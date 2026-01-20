'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'

const AVAILABLE_INTEGRATIONS = [
  {
    provider: 'google-calendar',
    name: 'Google Calendar',
    description: 'Read and manage calendar events',
    icon: '📅',
  },
  {
    provider: 'google-mail',
    name: 'Gmail',
    description: 'Search, read, and send emails',
    icon: '✉️',
  },
]

export default function IntegrationsPage() {
  const integrations = useQuery(api.integrations.list)
  const saveConnection = useMutation(api.integrations.saveConnection)
  const disconnect = useMutation(api.integrations.disconnect)

  const getStatus = (provider: string) => {
    const integration = integrations?.find((i) => i.provider === provider)
    if (!integration) return 'disconnected'
    return integration.status === 'active' ? 'connected' : integration.status
  }

  const handleConnect = async (provider: string, connectionId: string) => {
    await saveConnection({ provider, nangoConnectionId: connectionId })
  }

  const handleDisconnect = async (provider: string) => {
    await disconnect({ provider })
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Integrations</h1>
      <p className="text-muted-foreground mb-6">
        Connect external services to let Arlo access your calendar, email, and more.
      </p>

      <div className="space-y-4">
        {AVAILABLE_INTEGRATIONS.map((integration) => (
          <IntegrationCard
            key={integration.provider}
            provider={integration.provider}
            name={integration.name}
            description={integration.description}
            icon={integration.icon}
            status={
              getStatus(integration.provider) as
                | 'connected'
                | 'disconnected'
                | 'expired'
                | 'revoked'
            }
            onConnect={(connectionId) => handleConnect(integration.provider, connectionId)}
            onDisconnect={() => handleDisconnect(integration.provider)}
          />
        ))}
      </div>
    </div>
  )
}
