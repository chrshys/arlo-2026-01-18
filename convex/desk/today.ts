import { query } from '../_generated/server'
import { requireCurrentUser } from '../lib/auth'

// Helper to get start/end of day in user's timezone
function getDayBounds(timezone: string): { startOfDay: number; endOfDay: number } {
  const now = new Date()

  // Get the current date string in user's timezone
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone })

  // Create start of day in user's timezone
  const startOfDay = new Date(`${dateStr}T00:00:00`)
  const endOfDay = new Date(`${dateStr}T23:59:59.999`)

  // Adjust for timezone offset
  // For simplicity, we'll use UTC-based calculations
  // This works because we're comparing timestamps, not displaying times
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const offset = now.getTime() - userNow.getTime()

  return {
    startOfDay: startOfDay.getTime() + offset,
    endOfDay: endOfDay.getTime() + offset,
  }
}

export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const timezone = user.timezone || 'America/New_York'

    const { startOfDay, endOfDay } = getDayBounds(timezone)

    // Get all pending tasks for user
    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .collect()

    // Separate into categories
    const tasksDueToday = allTasks.filter((task) => {
      if (!task.dueDate) return false
      return task.dueDate >= startOfDay && task.dueDate <= endOfDay
    })

    const overdueTasks = allTasks.filter((task) => {
      if (!task.dueDate) return false
      return task.dueDate < startOfDay
    })

    // Sort by due date
    tasksDueToday.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
    overdueTasks.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))

    return {
      date: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: timezone,
      }),
      tasksDueToday,
      overdueTasks,
      // Calendar events would be added here when we integrate
      meetings: [] as Array<{ time: string; title: string }>,
    }
  },
})
