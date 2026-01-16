'use client'

import { type ReactNode } from 'react'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { cn } from '@/lib/utils'

interface MobilePanelProps {
  id: string
  children: ReactNode
  className?: string
}

function MobilePanel({ children, className }: MobilePanelProps) {
  return (
    <div className={cn('h-full w-full flex flex-col bg-background', className)}>{children}</div>
  )
}

interface MobileLayoutProps {
  listPanel?: ReactNode
  focusPanel: ReactNode
  canvasPanel?: ReactNode
}

export function MobileLayout({ listPanel, focusPanel, canvasPanel }: MobileLayoutProps) {
  const { activePanel, mobile } = usePanelLayout()

  // Render the appropriate panel based on navigation stack
  const renderActivePanel = () => {
    switch (activePanel) {
      case 'list':
        return listPanel ? (
          <MobilePanel id="list">{listPanel}</MobilePanel>
        ) : (
          <MobilePanel id="focus">{focusPanel}</MobilePanel>
        )
      case 'canvas':
        return canvasPanel ? (
          <MobilePanel id="canvas">{canvasPanel}</MobilePanel>
        ) : (
          <MobilePanel id="focus">{focusPanel}</MobilePanel>
        )
      case 'focus':
      default:
        return <MobilePanel id="focus">{focusPanel}</MobilePanel>
    }
  }

  return (
    <div className="h-full w-full relative">
      {renderActivePanel()}

      {/* Overlay panel (e.g., nav menu) */}
      {mobile.overlayPanel === 'nav' && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="h-full w-64 bg-background border-r border-border shadow-lg">
            {/* Nav content would go here */}
          </div>
        </div>
      )}
    </div>
  )
}
