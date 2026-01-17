'use client'

import { cn } from '@/lib/utils'
import { SmartListItem } from './SmartListItem'
import { SortableFolderTree } from './SortableFolderTree'
import { PanelHeader } from '@/components/layout/PanelHeader'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

interface TasksSidebarProps {
  className?: string
}

export function TasksSidebar({ className }: TasksSidebarProps) {
  const createFolder = useMutation(api.folders.create)
  const createProject = useMutation(api.projects.create)

  const handleAddFolder = async () => {
    await createFolder({ name: 'New Folder' })
  }

  const handleAddProject = async () => {
    await createProject({ name: 'New Project' })
  }

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <PanelHeader>
        <PanelHeader.Title>Tasks</PanelHeader.Title>
        <PanelHeader.Actions>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleAddProject}
            title="New project"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </PanelHeader.Actions>
      </PanelHeader>

      <div className="flex-1 overflow-auto p-2">
        {/* Smart Lists */}
        <div className="space-y-0.5 mb-4">
          <SmartListItem list="inbox" />
          <SmartListItem list="today" />
          <SmartListItem list="next7days" />
        </div>

        {/* Folders & Projects */}
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between px-3 py-1 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projects
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleAddFolder}
              title="New folder"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <SortableFolderTree />
        </div>
      </div>
    </div>
  )
}
