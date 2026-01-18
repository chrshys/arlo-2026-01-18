'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { ProjectItem } from './ProjectItem'

interface FolderItemProps {
  folderId: Id<'folders'>
  name: string
  color?: string
}

export function FolderItem({ folderId, name, color: _color }: FolderItemProps) {
  const { expandedFolders, toggleFolder } = useTaskNavigation()
  const projects = useQuery(api.projects.listByFolder, { folderId })

  const isExpanded = expandedFolders.has(folderId)
  const sortedProjects = projects?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? []

  return (
    <div>
      <button
        onClick={() => toggleFolder(folderId)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
          'hover:bg-accent/50'
        )}
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isExpanded && 'rotate-90')}
        />
        <span className="flex-1 text-left truncate font-medium">{name}</span>
      </button>

      {isExpanded && sortedProjects.length > 0 && (
        <div className="ml-2">
          {sortedProjects.map((project) => (
            <ProjectItem
              key={project._id}
              projectId={project._id}
              name={project.name}
              color={project.color}
              indent={1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
