'use client'

import { useState } from 'react'
import { Chat } from '@/components/Chat'
import { TaskList } from '@/components/TaskList'
import { AppShell, PanelHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Plus, CheckSquare } from 'lucide-react'

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
            <Chat threadId={threadId} onThreadCreated={setThreadId} />
          </AppShell.Focus>
        }
        canvas={
          <AppShell.Canvas>
            <PanelHeader>
              <PanelHeader.Title>
                <span className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Tasks
                </span>
              </PanelHeader.Title>
              <PanelHeader.Actions>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </PanelHeader.Actions>
            </PanelHeader>
            <div className="flex-1 overflow-auto">
              <TaskList />
            </div>
          </AppShell.Canvas>
        }
      />
    </AppShell>
  )
}
