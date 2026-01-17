'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { Id } from '@/convex/_generated/dataModel'

export type SmartListType = 'inbox' | 'today' | 'next7days'

export type TaskNavSelection =
  | { type: 'smart-list'; list: SmartListType }
  | { type: 'project'; projectId: Id<'projects'> }

interface TaskNavigationContextValue {
  selection: TaskNavSelection
  setSelection: (selection: TaskNavSelection) => void
  selectedTaskId: Id<'tasks'> | null
  setSelectedTaskId: (id: Id<'tasks'> | null) => void
  expandedFolders: Set<Id<'folders'>>
  toggleFolder: (folderId: Id<'folders'>) => void
  expandFolder: (folderId: Id<'folders'>) => void
}

const TaskNavigationContext = createContext<TaskNavigationContextValue | undefined>(undefined)

interface TaskNavigationProviderProps {
  children: ReactNode
}

export function TaskNavigationProvider({ children }: TaskNavigationProviderProps) {
  const [selection, setSelection] = useState<TaskNavSelection>({
    type: 'smart-list',
    list: 'inbox',
  })
  const [selectedTaskId, setSelectedTaskId] = useState<Id<'tasks'> | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<Id<'folders'>>>(new Set())

  const toggleFolder = (folderId: Id<'folders'>) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const expandFolder = (folderId: Id<'folders'>) => {
    setExpandedFolders((prev) => {
      if (prev.has(folderId)) return prev
      const next = new Set(prev)
      next.add(folderId)
      return next
    })
  }

  return (
    <TaskNavigationContext.Provider
      value={{
        selection,
        setSelection,
        selectedTaskId,
        setSelectedTaskId,
        expandedFolders,
        toggleFolder,
        expandFolder,
      }}
    >
      {children}
    </TaskNavigationContext.Provider>
  )
}

export function useTaskNavigation() {
  const context = useContext(TaskNavigationContext)
  if (!context) {
    throw new Error('useTaskNavigation must be used within a TaskNavigationProvider')
  }
  return context
}
