'use client'

import { type ReactNode } from 'react'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { IconRail } from './IconRail'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  const { isMobile } = usePanelLayout()

  return (
    <div className={cn('h-screen flex', className)}>
      {!isMobile && <IconRail />}
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  )
}
