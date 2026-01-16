'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Chat } from '@/components/Chat'
import { TaskList } from '@/components/TaskList'
import { AppShell } from '@/components/layout'

export default function Home() {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [showTasks, setShowTasks] = useState(false)

  return (
    <AppShell>
      <main className="flex-1 flex flex-col md:flex-row">
        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-h-0">
          <header className="p-4 border-b border-border flex items-center justify-between">
            <h1 className="text-xl font-bold">Arlo</h1>
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Settings
              </Link>
              <button
                onClick={() => setShowTasks(!showTasks)}
                className="md:hidden px-3 py-1 text-sm border border-border rounded hover:bg-muted/50"
              >
                {showTasks ? 'Chat' : 'Tasks'}
              </button>
            </div>
          </header>
          <div className={`flex-1 min-h-0 ${showTasks ? 'hidden md:flex' : 'flex'} flex-col`}>
            <Chat threadId={threadId} onThreadCreated={setThreadId} />
          </div>
        </div>

        {/* Task panel */}
        <div
          className={`${
            showTasks ? 'flex' : 'hidden md:flex'
          } flex-col w-full md:w-80 border-l border-border bg-muted/40`}
        >
          <TaskList />
        </div>
      </main>
    </AppShell>
  )
}
