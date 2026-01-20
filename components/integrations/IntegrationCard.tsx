'use client'

import { NangoConnectButton } from './NangoConnectButton'
import { CalendarSelector } from './CalendarSelector'

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
  const isGoogleCalendar = provider === 'google-calendar'

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-4">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{name}</h3>
            {isConnected && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                Connected
              </span>
            )}
            {needsReconnect && (
              <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                {status === 'expired' ? 'Expired' : 'Revoked'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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

      {isGoogleCalendar && <CalendarSelector isConnected={isConnected} />}
    </div>
  )
}
