'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Hash, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface DraggableProjectItemProps {
  projectId: Id<'projects'>
  name: string
  color?: string
}

export function DraggableProjectItem({ projectId, name, color }: DraggableProjectItemProps) {
  const { selection, setSelection, setSelectedTaskId } = useTaskNavigation()
  const tasks = useQuery(api.tasks.listByProject, { projectId })

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: projectId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isSelected = selection.type === 'project' && selection.projectId === projectId
  const pendingCount = tasks?.filter((t) => t.status === 'pending').length ?? 0

  const handleClick = () => {
    setSelection({ type: 'project', projectId })
    setSelectedTaskId(null)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm transition-colors',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground',
        isDragging && 'opacity-50 bg-accent'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
      </div>

      <button onClick={handleClick} className="flex items-center gap-2 flex-1 min-w-0">
        <Hash className="h-3.5 w-3.5 shrink-0" style={color ? { color } : undefined} />
        <span className="flex-1 text-left truncate">{name}</span>
        {pendingCount > 0 && <span className="text-xs text-muted-foreground">{pendingCount}</span>}
      </button>
    </div>
  )
}
