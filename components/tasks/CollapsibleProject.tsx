'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronRight, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionGroup } from './SectionGroup'
import { Id } from '@/convex/_generated/dataModel'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

interface Task {
  _id: Id<'tasks'>
  title: string
  status: 'pending' | 'completed'
  priority?: 'none' | 'low' | 'medium' | 'high' | null
  dueDate?: number | null
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface Note {
  _id: Id<'notes'>
  title: string
  sectionId?: Id<'sections'> | null
  sortOrder?: number | null
}

interface Section {
  _id: Id<'sections'>
  name: string
  sortOrder: number
}

interface CollapsibleProjectProps {
  projectId: Id<'projects'>
  projectName: string
  projectColor?: string
  tasks: Task[]
  notes: Note[]
  sections: Section[]
  defaultExpanded?: boolean
  hideCompletedSection?: boolean
}

export function CollapsibleProject({
  projectId,
  projectName,
  projectColor,
  tasks,
  notes,
  sections,
  defaultExpanded = true,
  hideCompletedSection = false,
}: CollapsibleProjectProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(projectName)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateProject = useMutation(api.projects.update)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Sync editedName when projectName prop changes (and not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditedName(projectName)
    }
  }, [projectName, isEditing])

  const handleSave = async () => {
    const trimmedName = editedName.trim() || 'New Project'
    if (trimmedName !== projectName) {
      await updateProject({ id: projectId, name: trimmedName })
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditedName(projectName)
      setIsEditing(false)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  // Tasks and notes without a section
  const unsectionedTasks = tasks.filter((t) => !t.sectionId)
  const unsectionedNotes = notes.filter((n) => !n.sectionId)

  // Sort sections
  const sortedSections = sections.slice().sort((a, b) => a.sortOrder - b.sortOrder)

  // Count pending tasks
  const pendingCount = tasks.filter((t) => t.status === 'pending').length

  return (
    <div className="mb-4">
      {/* Project Header */}
      <div className="group flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold hover:bg-accent/50 rounded-md transition-colors">
        <button onClick={() => setIsExpanded(!isExpanded)} className="shrink-0">
          <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
        </button>
        <Hash
          className="h-4 w-4 shrink-0"
          style={projectColor ? { color: projectColor } : undefined}
        />
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent outline-none border-b border-primary font-semibold"
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 text-left truncate cursor-pointer"
          >
            {projectName}
          </span>
        )}
        {pendingCount > 0 && <span className="text-xs text-muted-foreground">{pendingCount}</span>}
      </div>

      {/* Project Contents */}
      {isExpanded && (
        <div className="ml-6">
          {/* Unsectioned tasks and notes */}
          {(unsectionedTasks.length > 0 ||
            unsectionedNotes.length > 0 ||
            sections.length === 0) && (
            <SectionGroup
              tasks={unsectionedTasks}
              notes={unsectionedNotes}
              projectId={projectId}
              hideCompletedSection={hideCompletedSection}
            />
          )}

          {/* Sectioned tasks and notes */}
          {sortedSections.map((section) => {
            const sectionTasks = tasks.filter((t) => t.sectionId === section._id)
            const sectionNotes = notes.filter((n) => n.sectionId === section._id)
            return (
              <SectionGroup
                key={section._id}
                sectionId={section._id}
                sectionName={section.name}
                tasks={sectionTasks}
                notes={sectionNotes}
                projectId={projectId}
                hideCompletedSection={hideCompletedSection}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
