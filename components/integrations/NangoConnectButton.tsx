'use client'

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'

interface NangoConnectButtonProps {
  provider: string
  onSuccess: (connectionId: string) => void
  label?: string
}

export function NangoConnectButton({
  provider,
  onSuccess,
  label = 'Connect',
}: NangoConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const createSession = useAction(api.integrationsNode.createSession)

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      const { sessionToken } = await createSession({ provider })

      // Dynamically import Nango frontend SDK
      const { default: Nango } = await import('@nangohq/frontend')
      const nango = new Nango({ connectSessionToken: sessionToken })

      const result = await nango.auth(provider)

      if (result.connectionId) {
        onSuccess(result.connectionId)
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
    >
      {isLoading ? 'Connecting...' : label}
    </button>
  )
}
