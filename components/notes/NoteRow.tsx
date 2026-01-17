'use client'

import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Id } from '@/convex/_generated/dataModel'

interface NoteRowProps {
  noteId: Id<'notes'>
  title: string
  isSelected: boolean
  onSelect: (noteId: Id<'notes'>) => void
}

export function NoteRow({ noteId, title, isSelected, onSelect }: NoteRowProps) {
  return (
    <div
      onClick={() => onSelect(noteId)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer',
        'hover:bg-accent/50',
        isSelected && 'bg-accent text-accent-foreground'
      )}
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{title || 'Untitled'}</span>
    </div>
  )
}
