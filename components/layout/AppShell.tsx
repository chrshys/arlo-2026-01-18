'use client'

import { type ReactNode } from 'react'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { usePanelShortcuts } from '@/hooks/use-panel-shortcuts'
import { IconRail } from './IconRail'
import { AppHeader } from './AppHeader'
import { DesktopPanelLayout } from './DesktopPanelLayout'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  const { isMobile } = usePanelLayout()

  // Enable keyboard shortcuts
  usePanelShortcuts()

  return (
    <div className={cn('h-screen flex', className)}>
      {!isMobile && <IconRail />}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  )
}

// Panel wrapper components
interface PanelProps {
  children: ReactNode
  className?: string
}

function ListPanel({ children, className }: PanelProps) {
  return <div className={cn('h-full flex flex-col', className)}>{children}</div>
}

function FocusPanel({ children, className }: PanelProps) {
  return <div className={cn('h-full flex flex-col', className)}>{children}</div>
}

// Layout component that arranges panels
interface LayoutProps {
  list?: ReactNode
  focus: ReactNode
}

function Layout({ list, focus }: LayoutProps) {
  const { isMobile } = usePanelLayout()

  if (isMobile) {
    // For now, just show the focus panel on mobile
    return <div className="h-full">{focus}</div>
  }

  return <DesktopPanelLayout listPanel={list} focusPanel={focus} />
}

AppShell.List = ListPanel
AppShell.Focus = FocusPanel
AppShell.Layout = Layout
