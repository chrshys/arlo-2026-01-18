'use client'

import { useState, useRef, useEffect } from 'react'
import { Inbox, Calendar, CalendarDays, Hash, MoreVertical, Plus } from 'lucide-react'
import { PanelHeader } from '@/components/layout/PanelHeader'
import { useTaskNavigation, type SmartListType } from '@/hooks/use-task-navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'

const SMART_LIST_CONFIG: Record<
  SmartListType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  inbox: { label: 'Inbox', icon: Inbox },
  today: { label: 'Today', icon: Calendar },
  next7days: { label: 'Next 7 Days', icon: CalendarDays },
}

interface TaskListHeaderProps {
  onAddSection?: () => void
}

export function TaskListHeader({ onAddSection }: TaskListHeaderProps) {
  const { selection } = useTaskNavigation()
  const projects = useQuery(api.projects.list)

  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  let title = 'Tasks'
  let Icon: React.ComponentType<{ className?: string }> = Hash
  const isProject = selection.type === 'project'

  if (selection.type === 'smart-list') {
    const config = SMART_LIST_CONFIG[selection.list]
    title = config.label
    Icon = config.icon
  } else {
    const project = projects?.find((p) => p._id === selection.projectId)
    if (project) {
      title = project.name
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleAddSection = () => {
    setShowMenu(false)
    onAddSection?.()
  }

  return (
    <PanelHeader>
      <PanelHeader.Title>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </span>
      </PanelHeader.Title>

      {isProject && (
        <PanelHeader.Actions>
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px]">
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                  onClick={handleAddSection}
                >
                  <Plus className="h-3 w-3" />
                  Add section
                </button>
              </div>
            )}
          </div>
        </PanelHeader.Actions>
      )}
    </PanelHeader>
  )
}
