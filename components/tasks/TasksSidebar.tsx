'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { SmartListItem } from './SmartListItem'
import { SortableFolderTree } from './SortableFolderTree'
import { PanelHeader } from '@/components/layout/PanelHeader'
import { Button } from '@/components/ui/button'
import { Plus, Folder, Hash } from 'lucide-react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useTaskNavigation } from '@/hooks/use-task-navigation'

interface TasksSidebarProps {
  className?: string
}

export function TasksSidebar({ className }: TasksSidebarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const { setEditingFolderId, setEditingProjectId } = useTaskNavigation()

  const createFolder = useMutation(api.folders.create)
  const createProject = useMutation(api.projects.create)

  const handleAddFolder = async () => {
    setShowAddMenu(false)
    const folderId = await createFolder({ name: '' })
    setEditingFolderId(folderId)
  }

  const handleAddProject = async () => {
    setShowAddMenu(false)
    const projectId = await createProject({ name: '' })
    setEditingProjectId(projectId)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }

    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddMenu])

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
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projects
            </span>
            <div className="relative" ref={addMenuRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowAddMenu(!showAddMenu)}
                title="Add project or folder"
              >
                <Plus className="h-3 w-3" />
              </Button>

              {showAddMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px]">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={handleAddProject}
                  >
                    <Hash className="h-3 w-3" />
                    New project
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={handleAddFolder}
                  >
                    <Folder className="h-3 w-3" />
                    New folder
                  </button>
                </div>
              )}
            </div>
          </div>
          <SortableFolderTree />
        </div>
      </div>
    </div>
  )
}
