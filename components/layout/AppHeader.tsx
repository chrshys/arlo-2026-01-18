'use client'

import { Settings, Search, Menu, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface AppHeaderProps {
  className?: string
}

export function AppHeader({ className }: AppHeaderProps) {
  const { isMobile, popPanel, showOverlay, mobile } = usePanelLayout()

  const canGoBack = isMobile && mobile.stack.length > 1

  return (
    <header
      className={cn(
        'h-14 px-4 flex items-center gap-4 border-b border-border bg-background shrink-0',
        className
      )}
    >
      {/* Mobile: Menu or Back button */}
      {isMobile && (
        <>
          {canGoBack ? (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={popPanel}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => showOverlay('nav')}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </>
      )}

      <span className="font-bold text-lg">Arlo</span>

      {/* Search bar - hidden on small mobile */}
      <div className="flex-1 max-w-xl hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ask Arlo anything..."
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
          <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Mobile: Search icon button */}
      {isMobile && (
        <Button variant="ghost" size="icon" className="h-9 w-9 sm:hidden ml-auto">
          <Search className="h-5 w-5" />
        </Button>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href="/settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
