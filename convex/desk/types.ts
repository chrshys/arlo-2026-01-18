import { Id } from '../_generated/dataModel'

// Zone types - Today is computed, not stored
export type DeskZone = 'attention' | 'pinned' | 'working'

// Item types
export type DeskItemType = 'approval' | 'question' | 'task' | 'draft' | 'progress'

// Type-specific data shapes
export type ApprovalData = {
  actions: Array<{
    id: string
    label: string
    variant: 'primary' | 'secondary' | 'destructive'
  }>
  draftContent?: string
}

export type QuestionData = {
  question: string
  options: Array<{
    id: string
    label: string
  }>
}

export type TaskData = {
  taskId: Id<'tasks'>
}

export type DraftData = {
  draftType: 'email'
  to: string
  subject: string
  body: string
}

export type ProgressData = {
  operation: string
  percent?: number
  status: 'running' | 'completed' | 'failed'
}

export type DeskItemData = ApprovalData | QuestionData | TaskData | DraftData | ProgressData

// Full desk item shape (for UI)
export type DeskItem = {
  _id: Id<'deskItems'>
  _creationTime: number
  userId: Id<'users'>
  type: DeskItemType
  zone: DeskZone
  title: string
  description?: string
  data?: DeskItemData
  sourceThreadId?: string
  linkedEntityId?: string
  linkedEntityType?: string
  createdBy: 'user' | 'arlo'
  priority?: number
  status: 'active' | 'resolved' | 'dismissed'
  resolvedAt?: number
  resolution?: string
}
