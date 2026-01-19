'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, X } from 'lucide-react'
import { NoteEditor } from './NoteEditor'
import { useState, useEffect, useRef, useCallback } from 'react'

interface NoteDetailPanelProps {
  noteId: Id<'notes'>
  onClose: () => void
}

export function NoteDetailPanel({ noteId, onClose }: NoteDetailPanelProps) {
  const note = useQuery(api.notes.get, { id: noteId })
  const updateNote = useMutation(api.notes.update)
  const deleteNote = useMutation(api.notes.remove)

  const [title, setTitle] = useState('')
  const initializedRef = useRef<Id<'notes'> | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const focusEditorRef = useRef<(() => void) | null>(null)

  // Only sync from server on initial load or when noteId changes
  useEffect(() => {
    if (note && initializedRef.current !== noteId) {
      setTitle(note.title)
      initializedRef.current = noteId
    }
  }, [note, noteId])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const debouncedSave = useCallback(
    (newTitle: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        updateNote({ id: noteId, title: newTitle })
      }, 300)
    },
    [noteId, updateNote]
  )

  const handleEditorFocusReady = useCallback((focus: () => void) => {
    focusEditorRef.current = focus
  }, [])

  const handleContainerClick = useCallback(() => {
    focusEditorRef.current?.()
  }, [])

  if (!note) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    debouncedSave(newTitle)
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

      <div
        className="flex-1 overflow-auto p-4 flex flex-col min-h-0 cursor-text"
        onClick={handleContainerClick}
      >
        <NoteEditor
          noteId={noteId}
          initialContent={note.content}
          onFocusReady={handleEditorFocusReady}
        />
      </div>
    </div>
  )
}
