'use client'

import { useCallback, useEffect, useRef, useMemo } from 'react'
import { EditorRoot, EditorContent, JSONContent, useEditor, StarterKit } from 'novel'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface NoteEditorProps {
  noteId: Id<'notes'>
  initialContent: string
}

function EditorInner({ noteId }: { noteId: Id<'notes'> }) {
  const { editor } = useEditor()
  const updateContent = useMutation(api.notes.updateContent)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedSave = useCallback(
    (content: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        updateContent({ id: noteId, content })
      }, 500)
    },
    [noteId, updateContent]
  )

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      const json = JSON.stringify(editor.getJSON())
      debouncedSave(json)
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, debouncedSave])

  return null
}

export function NoteEditor({ noteId, initialContent }: NoteEditorProps) {
  const extensions = useMemo(() => [StarterKit], [])

  const parsedContent: JSONContent | undefined = useMemo(() => {
    if (!initialContent || initialContent === '') {
      return undefined
    }
    try {
      return JSON.parse(initialContent)
    } catch {
      return undefined
    }
  }, [initialContent])

  return (
    <div className="min-h-[300px] w-full">
      <EditorRoot>
        <EditorContent
          extensions={extensions}
          initialContent={parsedContent}
          className="prose dark:prose-invert prose-sm max-w-none"
        >
          <EditorInner noteId={noteId} />
        </EditorContent>
      </EditorRoot>
    </div>
  )
}
