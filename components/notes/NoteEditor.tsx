'use client'

import { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import {
  EditorRoot,
  EditorContent,
  EditorBubble,
  JSONContent,
  useEditor,
  StarterKit,
  TiptapUnderline,
  TiptapLink,
} from 'novel'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  Unlink,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  CodeSquare,
  LucideIcon,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskNavigation } from '@/hooks/use-task-navigation'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type BubbleCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'codeBlock'

interface BubbleButtonProps {
  command: BubbleCommand
  icon: LucideIcon
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Editor = any

const commandHandlers: Record<BubbleCommand, (editor: Editor) => void> = {
  bold: (editor) => editor.chain().focus().toggleBold().run(),
  italic: (editor) => editor.chain().focus().toggleItalic().run(),
  underline: (editor) => editor.chain().focus().toggleUnderline().run(),
  strike: (editor) => editor.chain().focus().toggleStrike().run(),
  code: (editor) => editor.chain().focus().toggleCode().run(),
  heading1: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 1 }).run(),
  heading2: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run(),
  heading3: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run(),
  bulletList: (editor) => editor.chain().focus().clearNodes().toggleBulletList().run(),
  orderedList: (editor) => editor.chain().focus().clearNodes().toggleOrderedList().run(),
  blockquote: (editor) => editor.chain().focus().clearNodes().toggleBlockquote().run(),
  codeBlock: (editor) => editor.chain().focus().clearNodes().toggleCodeBlock().run(),
}

const isActiveChecks: Record<BubbleCommand, (editor: Editor) => boolean> = {
  bold: (editor) => editor.isActive('bold'),
  italic: (editor) => editor.isActive('italic'),
  underline: (editor) => editor.isActive('underline'),
  strike: (editor) => editor.isActive('strike'),
  code: (editor) => editor.isActive('code'),
  heading1: (editor) => editor.isActive('heading', { level: 1 }),
  heading2: (editor) => editor.isActive('heading', { level: 2 }),
  heading3: (editor) => editor.isActive('heading', { level: 3 }),
  bulletList: (editor) => editor.isActive('bulletList'),
  orderedList: (editor) => editor.isActive('orderedList'),
  blockquote: (editor) => editor.isActive('blockquote'),
  codeBlock: (editor) => editor.isActive('codeBlock'),
}

function BubbleButton({ command, icon: Icon }: BubbleButtonProps) {
  const { editor } = useEditor()
  if (!editor) return null

  const isActive = isActiveChecks[command](editor)

  const handleClick = () => {
    commandHandlers[command](editor)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded cursor-pointer',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function LinkButton() {
  const { editor } = useEditor()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')

  if (!editor) return null

  const isActive = editor.isActive('link')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
    setUrl('')
    setOpen(false)
  }

  const handleUnlink = () => {
    editor.chain().focus().unsetLink().run()
    setOpen(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && isActive) {
      const attrs = editor.getAttributes('link')
      setUrl(attrs.href || '')
    } else if (!newOpen) {
      setUrl('')
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded cursor-pointer',
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Link className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1 h-7">
              <Check className="h-3 w-3 mr-1" />
              {isActive ? 'Update' : 'Add'}
            </Button>
            {isActive && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                onClick={handleUnlink}
              >
                <Unlink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function BubbleSeparator() {
  return <div className="h-4 w-px bg-border mx-0.5" />
}

interface NoteEditorProps {
  noteId: Id<'notes'>
  initialContent: string
}

function EditorInner({
  noteId,
  onEditorReady,
}: {
  noteId: Id<'notes'>
  onEditorReady: (focus: () => void) => void
}) {
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

  // Expose focus function to parent
  useEffect(() => {
    if (editor) {
      onEditorReady(() => editor.chain().focus('end').run())
    }
  }, [editor, onEditorReady])

  return null
}

export function NoteEditor({ noteId, initialContent }: NoteEditorProps) {
  const { shouldFocusNoteEditor, setShouldFocusNoteEditor } = useTaskNavigation()
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TiptapUnderline,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2 cursor-pointer',
        },
      }),
    ],
    []
  )
  const focusEditorRef = useRef<(() => void) | null>(null)
  const shouldFocusRef = useRef(shouldFocusNoteEditor)

  // Keep ref in sync with state
  useEffect(() => {
    shouldFocusRef.current = shouldFocusNoteEditor
  }, [shouldFocusNoteEditor])

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

  const handleEditorReady = useCallback(
    (focus: () => void) => {
      focusEditorRef.current = focus
      // Auto-focus if flag is set
      if (shouldFocusRef.current) {
        focus()
        setShouldFocusNoteEditor(false)
      }
    },
    [setShouldFocusNoteEditor]
  )

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only focus if clicking directly on the container, not on editor content
    if (e.target === e.currentTarget) {
      focusEditorRef.current?.()
    }
  }, [])

  return (
    <div className="h-full w-full flex flex-col cursor-text" onClick={handleContainerClick}>
      <EditorRoot>
        <EditorContent
          extensions={extensions}
          initialContent={parsedContent}
          immediatelyRender={false}
          className="prose dark:prose-invert prose-sm max-w-none flex-1 [&_.ProseMirror]:outline-none [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm"
          editorProps={{
            attributes: {
              spellcheck: 'true',
            },
          }}
        >
          <EditorInner noteId={noteId} onEditorReady={handleEditorReady} />
          <EditorBubble className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-1 shadow-lg">
            <BubbleButton command="bold" icon={Bold} />
            <BubbleButton command="italic" icon={Italic} />
            <BubbleButton command="underline" icon={Underline} />
            <BubbleButton command="strike" icon={Strikethrough} />
            <BubbleSeparator />
            <LinkButton />
            <BubbleSeparator />
            <BubbleButton command="heading1" icon={Heading1} />
            <BubbleButton command="heading2" icon={Heading2} />
            <BubbleButton command="heading3" icon={Heading3} />
            <BubbleSeparator />
            <BubbleButton command="bulletList" icon={List} />
            <BubbleButton command="orderedList" icon={ListOrdered} />
            <BubbleSeparator />
            <BubbleButton command="blockquote" icon={Quote} />
            <BubbleButton command="codeBlock" icon={CodeSquare} />
          </EditorBubble>
        </EditorContent>
      </EditorRoot>
    </div>
  )
}
