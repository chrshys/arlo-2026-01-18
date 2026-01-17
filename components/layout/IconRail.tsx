'use client'

import { MessageSquare, CheckSquare, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useAppMode, type AppMode } from '@/components/providers/app-mode-provider'

interface IconRailProps {
  className?: string
}

interface ModeButtonProps {
  mode: AppMode
  currentMode: AppMode
  icon: React.ReactNode
  title: string
  onClick: () => void
}

function ModeButton({ mode, currentMode, icon, title, onClick }: ModeButtonProps) {
  const isActive = mode === currentMode

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-10 w-10 relative', isActive && 'bg-accent text-accent-foreground')}
      title={title}
      onClick={onClick}
    >
      {icon}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
      )}
    </Button>
  )
}

export function IconRail({ className }: IconRailProps) {
  const { mode, setMode } = useAppMode()

  return (
    <div className={cn('flex flex-col h-full w-12 bg-muted/40 border-r border-border', className)}>
      <nav className="flex-1 flex flex-col items-center py-2 gap-1">
        <ModeButton
          mode="chat"
          currentMode={mode}
          icon={<MessageSquare className="h-5 w-5" />}
          title="Chat"
          onClick={() => setMode('chat')}
        />
        <ModeButton
          mode="tasks"
          currentMode={mode}
          icon={<CheckSquare className="h-5 w-5" />}
          title="Tasks"
          onClick={() => setMode('tasks')}
        />
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
