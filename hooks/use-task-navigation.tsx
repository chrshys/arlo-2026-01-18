'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { Id } from '@/convex/_generated/dataModel'

export type SmartListType = 'inbox' | 'today' | 'next7days'

export type TaskNavSelection =
  | { type: 'smart-list'; list: SmartListType }
  | { type: 'project'; projectId: Id<'projects'> }
  | { type: 'folder'; folderId: Id<'folders'> }

interface TaskNavigationContextValue {
  selection: TaskNavSelection
  setSelection: (selection: TaskNavSelection) => void
  selectedTaskId: Id<'tasks'> | null
  setSelectedTaskId: (id: Id<'tasks'> | null) => void
  selectedNoteId: Id<'notes'> | null
  setSelectedNoteId: (id: Id<'notes'> | null) => void
  editingNoteId: Id<'notes'> | null
  setEditingNoteId: (id: Id<'notes'> | null) => void
  editingFolderId: Id<'folders'> | null
  setEditingFolderId: (id: Id<'folders'> | null) => void
  editingProjectId: Id<'projects'> | null
  setEditingProjectId: (id: Id<'projects'> | null) => void
  shouldFocusNoteEditor: boolean
  setShouldFocusNoteEditor: (value: boolean) => void
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
  const [selectedTaskId, setSelectedTaskIdState] = useState<Id<'tasks'> | null>(null)
  const [selectedNoteId, setSelectedNoteIdState] = useState<Id<'notes'> | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<Id<'notes'> | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<Id<'folders'> | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<Id<'projects'> | null>(null)
  const [shouldFocusNoteEditor, setShouldFocusNoteEditor] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<Id<'folders'>>>(new Set())

  // Selecting a task clears selected note and vice versa
  const setSelectedTaskId = (id: Id<'tasks'> | null) => {
    setSelectedTaskIdState(id)
    if (id) setSelectedNoteIdState(null)
  }

  const setSelectedNoteId = (id: Id<'notes'> | null) => {
    setSelectedNoteIdState(id)
    if (id) setSelectedTaskIdState(null)
  }

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
        selectedNoteId,
        setSelectedNoteId,
        editingNoteId,
        setEditingNoteId,
        editingFolderId,
        setEditingFolderId,
        editingProjectId,
        setEditingProjectId,
        shouldFocusNoteEditor,
        setShouldFocusNoteEditor,
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
