'use client'

import { useState } from 'react'
import { ChevronRight, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionGroup } from './SectionGroup'
import { Id } from '@/convex/_generated/dataModel'

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
}

export function CollapsibleProject({
  projectId,
  projectName,
  projectColor,
  tasks,
  notes,
  sections,
  defaultExpanded = true,
}: CollapsibleProjectProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

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
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold hover:bg-accent/50 rounded-md transition-colors"
      >
        <ChevronRight
          className={cn('h-4 w-4 shrink-0 transition-transform', isExpanded && 'rotate-90')}
        />
        <Hash
          className="h-4 w-4 shrink-0"
          style={projectColor ? { color: projectColor } : undefined}
        />
        <span className="flex-1 text-left truncate">{projectName}</span>
        {pendingCount > 0 && <span className="text-xs text-muted-foreground">{pendingCount}</span>}
      </button>

      {/* Project Contents */}
      {isExpanded && (
        <div className="ml-6">
          {/* Unsectioned tasks and notes */}
          {(unsectionedTasks.length > 0 ||
            unsectionedNotes.length > 0 ||
            sections.length === 0) && (
            <SectionGroup tasks={unsectionedTasks} notes={unsectionedNotes} projectId={projectId} />
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
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
