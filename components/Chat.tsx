'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ChatProps {
  threadId: string | null
  onThreadCreated: (id: string) => void
}

export function Chat({ threadId, onThreadCreated }: ChatProps) {
  const [input, setInput] = useState('')
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const createThread = useMutation(api.threads.create)
  const sendMessage = useMutation(api.chat.send)

  const { results: messages, status } = usePaginatedQuery(
    api.threads.messages,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 50 }
  )

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const message = input.trim()
    setInput('')

    let currentThreadId = threadId

    // Create thread if needed
    if (!currentThreadId) {
      setIsCreatingThread(true)
      try {
        // createThread returns the threadId directly as a string
        currentThreadId = await createThread()
        onThreadCreated(currentThreadId)
      } catch (error) {
        console.error('Failed to create thread:', error)
        setIsCreatingThread(false)
        return
      }
      setIsCreatingThread(false)
    }

    // Send message
    try {
      await sendMessage({ prompt: message, threadId: currentThreadId })
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const isLoading = status === 'LoadingFirstPage'

  // Get message role from the message object
  const getRole = (msg: (typeof messages)[number]) => {
    return msg.message?.role ?? 'assistant'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="text-muted-foreground text-center">Loading...</div>
        ) : messages && messages.length > 0 ? (
          [...messages]
            .reverse() // Reverse to show oldest first (newest at bottom)
            .filter((msg) => !msg.tool) // Filter out tool messages
            .map((msg) => {
              const role = getRole(msg)
              return (
                <div
                  key={msg._id}
                  className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.text || ''}
                  </div>
                </div>
              )
            })
        ) : (
          <div className="text-muted-foreground text-center">Start a conversation with Arlo</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Arlo..."
            disabled={isCreatingThread}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isCreatingThread}>
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}
