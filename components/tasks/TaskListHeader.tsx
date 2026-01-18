'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Inbox,
  Calendar,
  CalendarDays,
  Hash,
  Folder,
  MoreVertical,
  Plus,
  CheckSquare,
  FileText,
} from 'lucide-react'
import { PanelHeader } from '@/components/layout/PanelHeader'
import { useTaskNavigation, type SmartListType } from '@/hooks/use-task-navigation'
import { useQuery, useMutation } from 'convex/react'
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
  onAddTask?: () => void
}

export function TaskListHeader({ onAddSection, onAddTask }: TaskListHeaderProps) {
  const { selection, setEditingNoteId } = useTaskNavigation()
  const projects = useQuery(api.projects.list)
  const folders = useQuery(api.folders.list)
  const createNote = useMutation(api.notes.createFromUI)

  const [showMenu, setShowMenu] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  let title = 'Tasks'
  let Icon: React.ComponentType<{ className?: string }> = Hash
  const isProject = selection.type === 'project'
  const isFolder = selection.type === 'folder'

  if (selection.type === 'smart-list') {
    const config = SMART_LIST_CONFIG[selection.list]
    title = config.label
    Icon = config.icon
  } else if (selection.type === 'project') {
    const project = projects?.find((p) => p._id === selection.projectId)
    if (project) {
      title = project.name
    }
  } else if (selection.type === 'folder') {
    const folder = folders?.find((f) => f._id === selection.folderId)
    if (folder) {
      title = folder.name
    }
    Icon = Folder
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }

    if (showMenu || showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu, showAddMenu])

  const handleAddSection = () => {
    setShowMenu(false)
    onAddSection?.()
  }

  const handleAddNote = async () => {
    setShowAddMenu(false)
    const projectId = selection.type === 'project' ? selection.projectId : undefined
    const noteId = await createNote({ title: '', projectId })
    setEditingNoteId(noteId)
  }

  return (
    <PanelHeader>
      <PanelHeader.Title>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </span>
      </PanelHeader.Title>

      <PanelHeader.Actions>
        {/* Add button with dropdown - hidden for folders since items belong to projects */}
        {!isFolder && (
          <div className="relative" ref={addMenuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <Plus className="h-4 w-4" />
            </Button>

            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px]">
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                  onClick={() => {
                    setShowAddMenu(false)
                    onAddTask?.()
                  }}
                >
                  <CheckSquare className="h-3 w-3" />
                  New task
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                  onClick={handleAddNote}
                >
                  <FileText className="h-3 w-3" />
                  New note
                </button>
              </div>
            )}
          </div>
        )}

        {/* More menu for projects */}
        {isProject && (
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
        )}
      </PanelHeader.Actions>
    </PanelHeader>
  )
}
