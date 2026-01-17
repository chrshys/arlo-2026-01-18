'use client'

import { type ReactNode } from 'react'
import { IconRail } from './IconRail'
import { AppHeader } from './AppHeader'
import { DesktopPanelLayout } from './DesktopPanelLayout'
import { MobileLayout } from './MobileLayout'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { cn } from '@/lib/utils'
import { type ContentMaxWidth, CONTENT_MAX_WIDTHS } from '@/types/panel-layout'

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  const { isMobile } = usePanelLayout()

  return (
    <div className={cn('h-screen flex flex-col', className)}>
      <AppHeader />
      <div className="flex-1 flex min-h-0">
        {!isMobile && <IconRail />}
        <div className="flex-1 min-w-0">{children}</div>
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

interface FocusPanelProps extends PanelProps {
  contentMaxWidth?: ContentMaxWidth
}

function FocusPanel({ children, className, contentMaxWidth }: FocusPanelProps) {
  const maxWidth = contentMaxWidth ? CONTENT_MAX_WIDTHS[contentMaxWidth] : undefined

  return (
    <div className={cn('h-full w-full flex flex-col', className)}>
      <div
        className="flex-1 flex flex-col min-h-0 mx-auto w-full"
        style={maxWidth ? { maxWidth } : undefined}
      >
        {children}
      </div>
    </div>
  )
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
  const { isMobile } = usePanelLayout()

  if (isMobile) {
    return <MobileLayout listPanel={list} focusPanel={focus} canvasPanel={canvas} />
  }

  return <DesktopPanelLayout listPanel={list} focusPanel={focus} canvasPanel={canvas} />
}

AppShell.List = ListPanel
AppShell.Focus = FocusPanel
AppShell.Canvas = CanvasPanel
AppShell.Layout = Layout
