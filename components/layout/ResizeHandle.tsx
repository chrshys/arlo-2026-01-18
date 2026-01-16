'use client'

import { Separator } from 'react-resizable-panels'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  className?: string
  id?: string
}

export function ResizeHandle({ className, id }: ResizeHandleProps) {
  return (
    <Separator
      id={id}
      className={cn(
        'group relative w-1 bg-transparent hover:bg-primary/10 transition-colors',
        'data-[resize-handle-active]:bg-primary/20',
        className
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border',
          'group-hover:w-0.5 group-hover:bg-primary/50',
          'group-data-[resize-handle-active]:w-0.5 group-data-[resize-handle-active]:bg-primary'
        )}
      />
    </Separator>
  )
}
