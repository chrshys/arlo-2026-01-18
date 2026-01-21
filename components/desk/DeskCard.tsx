import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DeskCardProps = {
  title: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  variant?: 'default' | 'attention' | 'progress'
  className?: string
}

export function DeskCard({
  title,
  description,
  icon,
  actions,
  children,
  variant = 'default',
  className,
}: DeskCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm',
        variant === 'attention' && 'border-l-4 border-l-red-500',
        variant === 'progress' && 'border-l-4 border-l-blue-500',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <div className="flex-shrink-0 text-muted-foreground">{icon}</div>}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium leading-tight">{title}</h4>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
      {actions && <div className="mt-3 flex items-center gap-2 border-t pt-3">{actions}</div>}
    </div>
  )
}
