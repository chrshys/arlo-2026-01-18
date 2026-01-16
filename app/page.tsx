'use client'

import { useState } from 'react'
import { Chat } from '@/components/Chat'
import { TaskList } from '@/components/TaskList'
import { AppShell, PanelHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function Home() {
  const [threadId, setThreadId] = useState<string | null>(null)

  return (
    <AppShell>
      <AppShell.Layout
        list={
          <AppShell.List>
            <PanelHeader>
              <PanelHeader.Title>Conversations</PanelHeader.Title>
              <PanelHeader.Actions>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </PanelHeader.Actions>
            </PanelHeader>
            <div className="flex-1 overflow-auto p-2">
              <div className="text-sm text-muted-foreground p-2">Chat history will appear here</div>
            </div>
          </AppShell.List>
        }
        focus={
          <AppShell.Focus>
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              {/* Chat panel */}
              <div className="flex-1 flex flex-col min-h-0">
                <Chat threadId={threadId} onThreadCreated={setThreadId} />
              </div>

              {/* Task panel - temporary placement until Phase 5 */}
              <div className="hidden md:flex flex-col w-80 border-l border-border bg-muted/40">
                <TaskList />
              </div>
            </div>
          </AppShell.Focus>
        }
      />
    </AppShell>
  )
}
