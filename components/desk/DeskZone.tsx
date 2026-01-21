import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DeskZoneProps = {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  emptyMessage?: string
  isEmpty?: boolean
}

export function DeskZone({
  title,
  icon,
  children,
  className,
  emptyMessage = 'Nothing here',
  isEmpty = false,
}: DeskZoneProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {isEmpty ? (
        <p className="py-2 text-xs italic text-muted-foreground/60">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}
