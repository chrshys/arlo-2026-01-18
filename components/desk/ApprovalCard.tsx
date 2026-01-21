'use client'

import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DeskCard } from './DeskCard'
import { Button } from '@/components/ui/button'
import { Mail, MessageSquare, Pin, X } from 'lucide-react'

type ApprovalCardProps = {
  id: Id<'deskItems'>
  title: string
  description?: string
  type: 'draft' | 'approval' | 'question'
  data?: {
    actions?: Array<{
      id: string
      label: string
      variant: 'primary' | 'secondary' | 'destructive'
    }>
    draftContent?: string
    question?: string
    options?: Array<{ id: string; label: string }>
    draftType?: string
    to?: string
    subject?: string
    body?: string
  }
}

export function ApprovalCard({ id, title, description, type, data }: ApprovalCardProps) {
  const resolve = useMutation(api.desk.mutations.resolve)
  const dismiss = useMutation(api.desk.mutations.dismiss)
  const pin = useMutation(api.desk.mutations.pin)

  const handleAction = async (actionId: string) => {
    await resolve({ id, resolution: actionId })
  }

  const handleDismiss = async () => {
    await dismiss({ id })
  }

  const handlePin = async () => {
    await pin({ id })
  }

  const icon =
    type === 'draft' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />

  // For drafts, show preview
  const draftPreview =
    type === 'draft' && data?.to ? (
      <div className="space-y-1 rounded bg-muted/50 p-2 text-xs">
        <div>
          <span className="text-muted-foreground">To:</span> {data.to}
        </div>
        {data.subject && (
          <div>
            <span className="text-muted-foreground">Re:</span> {data.subject}
          </div>
        )}
        {data.body && <div className="mt-2 line-clamp-3 text-muted-foreground">{data.body}</div>}
      </div>
    ) : null

  // For questions, show options
  const questionOptions =
    type === 'question' && data?.options ? (
      <div className="flex flex-wrap gap-2">
        {data.options.map((option) => (
          <Button
            key={option.id}
            variant="outline"
            size="sm"
            onClick={() => handleAction(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    ) : null

  // Default actions for approvals/drafts
  const defaultActions =
    type !== 'question' ? (
      <>
        {data?.actions?.map((action) => (
          <Button
            key={action.id}
            variant={
              action.variant === 'primary'
                ? 'default'
                : action.variant === 'destructive'
                  ? 'destructive'
                  : 'outline'
            }
            size="sm"
            onClick={() => handleAction(action.id)}
          >
            {action.label}
          </Button>
        )) ?? (
          <>
            <Button size="sm" onClick={() => handleAction('approved')}>
              Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAction('edit')}>
              Edit
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={handlePin}>
          <Pin className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </>
    ) : (
      <Button variant="ghost" size="icon" onClick={handleDismiss}>
        <X className="h-4 w-4" />
      </Button>
    )

  return (
    <DeskCard
      title={title}
      description={description}
      icon={icon}
      variant="attention"
      actions={defaultActions}
    >
      {draftPreview}
      {questionOptions}
    </DeskCard>
  )
}
