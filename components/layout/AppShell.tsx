'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  return <div className={cn('h-screen flex flex-col', className)}>{children}</div>
}
