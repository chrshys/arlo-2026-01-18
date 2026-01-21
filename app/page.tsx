'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Chat } from '@/components/Chat'
import { DeskPanel } from '@/components/desk'
import { ConversationList } from '@/components/ConversationList'
import { AppShell, PanelHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Plus, LayoutDashboard } from 'lucide-react'
import { useAppMode } from '@/components/providers/app-mode-provider'
import { TasksView } from '@/components/tasks'

function ChatMode() {
  const [threadId, setThreadId] = useState<string | null>(null)
  const createThread = useMutation(api.threads.create)

  const handleNewThread = async () => {
    const newThreadId = await createThread()
    setThreadId(newThreadId)
  }

  return (
    <AppShell.Layout
      list={
        <AppShell.List>
          <PanelHeader>
            <PanelHeader.Title>Conversations</PanelHeader.Title>
            <PanelHeader.Actions>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNewThread}
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </PanelHeader.Actions>
          </PanelHeader>
          <div className="flex-1 overflow-auto">
            <ConversationList selectedThreadId={threadId} onSelectThread={setThreadId} />
          </div>
        </AppShell.List>
      }
      focus={
        <AppShell.Focus contentMaxWidth="medium">
          <Chat threadId={threadId} />
        </AppShell.Focus>
      }
      canvas={
        <AppShell.Canvas>
          <PanelHeader>
            <PanelHeader.Title>
              <span className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Desk
              </span>
            </PanelHeader.Title>
          </PanelHeader>
          <DeskPanel />
        </AppShell.Canvas>
      }
    />
  )
}

export default function Home() {
  const { mode } = useAppMode()

  return <AppShell>{mode === 'chat' ? <ChatMode /> : <TasksView />}</AppShell>
}
