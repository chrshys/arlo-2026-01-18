'use client'

import { NangoConnectButton } from './NangoConnectButton'

interface IntegrationCardProps {
  provider: string
  name: string
  description: string
  icon: React.ReactNode
  status: 'connected' | 'disconnected' | 'expired' | 'revoked'
  onConnect: (connectionId: string) => void
  onDisconnect: () => void
}

export function IntegrationCard({
  provider,
  name,
  description,
  icon,
  status,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const isConnected = status === 'connected'
  const needsReconnect = status === 'expired' || status === 'revoked'

  return (
    <div className="border border-border rounded-lg p-4 flex items-start gap-4">
      <div className="text-2xl">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{name}</h3>
          {isConnected && (
            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
              Connected
            </span>
          )}
          {needsReconnect && (
            <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded">
              {status === 'expired' ? 'Expired' : 'Revoked'}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div>
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Disconnect
          </button>
        ) : (
          <NangoConnectButton
            provider={provider}
            onSuccess={onConnect}
            label={needsReconnect ? 'Reconnect' : 'Connect'}
          />
        )}
      </div>
    </div>
  )
}
