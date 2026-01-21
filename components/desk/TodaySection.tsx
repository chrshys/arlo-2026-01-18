'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { DeskZone } from './DeskZone'
import { DeskCard } from './DeskCard'
import { Sun, AlertCircle, CheckSquare, Calendar } from 'lucide-react'

export function TodaySection() {
  const today = useQuery(api.desk.today.getToday)

  if (!today) {
    return (
      <DeskZone title="TODAY" icon={<Sun className="h-4 w-4" />}>
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </DeskZone>
    )
  }

  const hasContent =
    today.tasksDueToday.length > 0 || today.overdueTasks.length > 0 || today.meetings.length > 0

  return (
    <DeskZone
      title={`TODAY · ${today.date}`}
      icon={<Sun className="h-4 w-4" />}
      isEmpty={!hasContent}
      emptyMessage="Nothing scheduled for today"
    >
      {/* Meetings */}
      {today.meetings.length > 0 && (
        <DeskCard
          title={`${today.meetings.length} meeting${today.meetings.length > 1 ? 's' : ''}`}
          icon={<Calendar className="h-4 w-4" />}
        >
          <ul className="space-y-1 text-xs">
            {today.meetings.map((meeting, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">{meeting.time}</span>
                <span>{meeting.title}</span>
              </li>
            ))}
          </ul>
        </DeskCard>
      )}

      {/* Tasks due today */}
      {today.tasksDueToday.length > 0 && (
        <DeskCard
          title={`${today.tasksDueToday.length} task${today.tasksDueToday.length > 1 ? 's' : ''} due`}
          icon={<CheckSquare className="h-4 w-4" />}
        >
          <ul className="space-y-1 text-xs">
            {today.tasksDueToday.map((task) => (
              <li key={task._id} className="truncate">
                {task.title}
              </li>
            ))}
          </ul>
        </DeskCard>
      )}

      {/* Overdue tasks */}
      {today.overdueTasks.length > 0 && (
        <DeskCard
          title={`${today.overdueTasks.length} overdue`}
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          variant="attention"
        >
          <ul className="space-y-1 text-xs">
            {today.overdueTasks.map((task) => {
              const daysOverdue = task.dueDate
                ? Math.floor((Date.now() - task.dueDate) / (1000 * 60 * 60 * 24))
                : 0
              return (
                <li key={task._id} className="flex justify-between">
                  <span className="truncate">{task.title}</span>
                  <span className="text-xs text-red-500">{daysOverdue}d overdue</span>
                </li>
              )
            })}
          </ul>
        </DeskCard>
      )}
    </DeskZone>
  )
}
