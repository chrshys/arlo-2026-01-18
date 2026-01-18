'use client'

import { useConvexAuth, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { ReactNode, useEffect, useState } from 'react'

export function UserProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const ensureUser = useMutation(api.users.ensureUser)
  const [userEnsured, setUserEnsured] = useState(false)

  useEffect(() => {
    if (isLoading) {
      setUserEnsured(false)
      return
    }

    if (!isAuthenticated) {
      setUserEnsured(true)
      return
    }

    // Authenticated - ensure user exists in DB
    setUserEnsured(false)
    let cancelled = false

    ensureUser()
      .then(() => {
        if (!cancelled) setUserEnsured(true)
      })
      .catch((err) => {
        console.error('Failed to ensure user:', err)
        if (!cancelled) setUserEnsured(true)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated])

  if (isLoading || !userEnsured) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return <>{children}</>
}
