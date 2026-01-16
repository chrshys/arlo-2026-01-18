'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PanelHeaderProps {
  children: ReactNode
  className?: string
}

export function PanelHeader({ children, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'h-12 px-4 flex items-center justify-between border-b border-border shrink-0',
        className
      )}
    >
      {children}
    </div>
  )
}

function PanelHeaderTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('font-semibold text-sm', className)}>{children}</h2>
}

function PanelHeaderActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-1', className)}>{children}</div>
}

PanelHeader.Title = PanelHeaderTitle
PanelHeader.Actions = PanelHeaderActions
