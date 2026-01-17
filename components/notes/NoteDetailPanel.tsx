'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, X } from 'lucide-react'
import { NoteEditor } from './NoteEditor'
import { useState, useEffect } from 'react'

interface NoteDetailPanelProps {
  noteId: Id<'notes'>
  onClose: () => void
}

export function NoteDetailPanel({ noteId, onClose }: NoteDetailPanelProps) {
  const note = useQuery(api.notes.get, { id: noteId })
  const updateNote = useMutation(api.notes.update)
  const deleteNote = useMutation(api.notes.remove)

  const [title, setTitle] = useState('')

  useEffect(() => {
    if (note) {
      setTitle(note.title)
    }
  }, [note])

  if (!note) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    updateNote({ id: noteId, title: newTitle })
  }

  const handleDelete = async () => {
    await deleteNote({ id: noteId })
    onClose()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="text-lg font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <NoteEditor noteId={noteId} initialContent={note.content} />
      </div>
    </div>
  )
}
