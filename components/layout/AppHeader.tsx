'use client'

import { Search, Menu, ChevronLeft, PanelLeft, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  className?: string
}

export function AppHeader({ className }: AppHeaderProps) {
  const { isMobile, popPanel, showOverlay, mobile, layout, toggleListPanel, toggleCanvasPanel } =
    usePanelLayout()

  const canGoBack = isMobile && mobile.stack.length > 1

  return (
    <header
      className={cn(
        'h-14 px-4 flex items-center border-b border-border bg-background shrink-0',
        className
      )}
    >
      {/* Left section - app name */}
      <div className="flex items-center gap-2 min-w-[100px]">
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
      </div>

      {/* Center section - search bar */}
      <div className="flex-1 flex justify-center px-4">
        <div className="w-full max-w-xl hidden sm:block">
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
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:hidden">
            <Search className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Right section - panel toggle buttons */}
      <div className="flex items-center justify-end gap-1 min-w-[100px]">
        {!isMobile && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', layout.listPanelVisible && 'bg-muted')}
              onClick={toggleListPanel}
              title="Toggle sidebar (⌘B)"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', layout.canvasPanelVisible && 'bg-muted')}
              onClick={toggleCanvasPanel}
              title="Toggle canvas (⌘\)"
            >
              <PanelRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
