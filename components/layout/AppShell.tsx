'use client'

import { type ReactNode } from 'react'
import { IconRail } from './IconRail'
import { AppHeader } from './AppHeader'
import { DesktopPanelLayout } from './DesktopPanelLayout'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  // Temporarily removed usePanelLayout to debug
  return (
    <div className={cn('h-screen flex', className)}>
      <IconRail />
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
  return <div className={cn('h-full w-full flex flex-col', className)}>{children}</div>
}

function FocusPanel({ children, className }: PanelProps) {
  return <div className={cn('h-full w-full flex flex-col', className)}>{children}</div>
}

// Canvas panel wrapper
function CanvasPanel({ children, className }: PanelProps) {
  return <div className={cn('h-full w-full flex flex-col', className)}>{children}</div>
}

// Layout component that arranges panels
interface LayoutProps {
  list?: ReactNode
  focus: ReactNode
  canvas?: ReactNode
}

function Layout({ list, focus, canvas }: LayoutProps) {
  return <DesktopPanelLayout listPanel={list} focusPanel={focus} canvasPanel={canvas} />
}

AppShell.List = ListPanel
AppShell.Focus = FocusPanel
AppShell.Canvas = CanvasPanel
AppShell.Layout = Layout
