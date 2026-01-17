'use client'

import { Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface ProjectItemProps {
  projectId: Id<'projects'>
  name: string
  color?: string
  indent?: number
}

export function ProjectItem({ projectId, name, color, indent = 0 }: ProjectItemProps) {
  const { selection, setSelection, setSelectedTaskId } = useTaskNavigation()
  const tasks = useQuery(api.tasks.listByProject, { projectId })

  const isSelected = selection.type === 'project' && selection.projectId === projectId
  const pendingCount = tasks?.filter((t) => t.status === 'pending').length ?? 0

  const handleClick = () => {
    setSelection({ type: 'project', projectId })
    setSelectedTaskId(null)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground'
      )}
      style={{ paddingLeft: `${12 + indent * 16}px` }}
    >
      <Hash className="h-3.5 w-3.5 shrink-0" style={color ? { color } : undefined} />
      <span className="flex-1 text-left truncate">{name}</span>
      {pendingCount > 0 && <span className="text-xs text-muted-foreground">{pendingCount}</span>}
    </button>
  )
}
