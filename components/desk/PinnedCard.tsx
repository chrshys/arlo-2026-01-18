'use client'

import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DeskCard } from './DeskCard'
import { Button } from '@/components/ui/button'
import { Pin, ExternalLink, Check } from 'lucide-react'

type PinnedCardProps = {
  id: Id<'deskItems'>
  title: string
  description?: string
  linkedEntityType?: string
  linkedEntityId?: string
}

export function PinnedCard({ id, title, description, linkedEntityType }: PinnedCardProps) {
  const unpin = useMutation(api.desk.mutations.unpin)
  const resolve = useMutation(api.desk.mutations.resolve)

  const handleUnpin = async () => {
    await unpin({ id })
  }

  const handleComplete = async () => {
    await resolve({ id, resolution: 'completed' })
  }

  return (
    <DeskCard
      title={title}
      description={description}
      icon={<Pin className="h-4 w-4 text-amber-500" />}
      actions={
        <>
          {linkedEntityType && (
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-1 h-3 w-3" />
              Open
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleComplete}>
            <Check className="mr-1 h-3 w-3" />
            Done
          </Button>
          <Button variant="ghost" size="sm" onClick={handleUnpin}>
            Unpin
          </Button>
        </>
      }
    />
  )
}
