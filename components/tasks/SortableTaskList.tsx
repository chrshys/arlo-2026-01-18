'use client'

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
import { Id } from '@/convex/_generated/dataModel'
import { DraggableTaskRow } from './DraggableTaskRow'

interface Task {
  _id: Id<'tasks'>
  title: string
  status: 'pending' | 'completed'
  priority?: 'none' | 'low' | 'medium' | 'high' | null
  dueDate?: number | null
  reminders?: number[] | null
  sortOrder?: number | null
}

interface SortableTaskListProps {
  tasks: Task[]
  showCompleted?: boolean
}

export function SortableTaskList({ tasks, showCompleted = false }: SortableTaskListProps) {
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
    <div className="space-y-0.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
              reminders={task.reminders}
            />
          ))}
        </SortableContext>
      </DndContext>

      {showCompleted && completedTasks.length > 0 && (
        <div className="mt-4 pt-2 border-t border-border">
          <p className="px-3 py-1 text-xs text-muted-foreground mb-1">
            Completed ({completedTasks.length})
          </p>
          {completedTasks.map((task) => (
            <DraggableTaskRow
              key={task._id}
              taskId={task._id}
              title={task.title}
              status={task.status}
              priority={task.priority}
              dueDate={task.dueDate}
              reminders={task.reminders}
            />
          ))}
        </div>
      )}
    </div>
  )
}
