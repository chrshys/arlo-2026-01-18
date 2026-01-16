'use client'

import { Home, MessageSquare, CheckSquare, FileText, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface IconRailProps {
  className?: string
}

export function IconRail({ className }: IconRailProps) {
  return (
    <div className={cn('flex flex-col h-full w-12 bg-muted/40 border-r border-border', className)}>
      <nav className="flex-1 flex flex-col items-center py-2 gap-1">
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Home">
          <Home className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Chat">
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Tasks">
          <CheckSquare className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Documents">
          <FileText className="h-5 w-5" />
        </Button>
      </nav>
      <div className="flex flex-col items-center py-2 border-t border-border">
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Settings" asChild>
          <Link href="/settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
