'use client'

import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { DraggableTaskRow } from './DraggableTaskRow'
import { QuickAddTask } from './QuickAddTask'
import { Id } from '@/convex/_generated/dataModel'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

interface Task {
  _id: Id<'tasks'>
  title: string
  status: 'pending' | 'completed'
  priority?: 'none' | 'low' | 'medium' | 'high' | null
  dueDate?: number | null
  sortOrder?: number | null
}

interface SectionGroupProps {
  sectionId?: Id<'sections'>
  sectionName?: string
  tasks: Task[]
  projectId?: Id<'projects'>
  showCompleted?: boolean
}

export function SectionGroup({
  sectionId,
  sectionName,
  tasks,
  projectId,
  showCompleted = false,
}: SectionGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(showCompleted)
  const reorderTasks = useMutation(api.tasks.reorder)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const pendingTasks = tasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = pendingTasks.findIndex((t) => t._id === active.id)
      const newIndex = pendingTasks.findIndex((t) => t._id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...pendingTasks]
        const [removed] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, removed)

        await reorderTasks({ orderedIds: reordered.map((t) => t._id) })
      }
    }
  }

  return (
    <div className="mb-4">
      {sectionName && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', !isCollapsed && 'rotate-90')}
          />
          {sectionName}
          <span className="ml-1 text-xs">({pendingTasks.length})</span>
        </button>
      )}

      {!isCollapsed && (
        <div className="space-y-0.5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pendingTasks.map((t) => t._id)}
              strategy={verticalListSortingStrategy}
            >
              {pendingTasks.map((task) => (
                <DraggableTaskRow
                  key={task._id}
                  taskId={task._id}
                  title={task.title}
                  status={task.status}
                  priority={task.priority}
                  dueDate={task.dueDate}
                />
              ))}
            </SortableContext>
          </DndContext>

          <QuickAddTask projectId={projectId} sectionId={sectionId} />

          {completedTasks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                className="flex items-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronRight
                  className={cn('h-3 w-3 transition-transform', showCompletedTasks && 'rotate-90')}
                />
                Completed ({completedTasks.length})
              </button>

              {showCompletedTasks && (
                <div className="mt-1 space-y-0.5">
                  {completedTasks.map((task) => (
                    <DraggableTaskRow
                      key={task._id}
                      taskId={task._id}
                      title={task.title}
                      status={task.status}
                      priority={task.priority}
                      dueDate={task.dueDate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
