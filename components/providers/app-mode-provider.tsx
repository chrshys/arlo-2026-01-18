'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type AppMode = 'chat' | 'tasks'

interface AppModeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

const AppModeContext = createContext<AppModeContextValue | undefined>(undefined)

interface AppModeProviderProps {
  children: ReactNode
  defaultMode?: AppMode
}

export function AppModeProvider({ children, defaultMode = 'chat' }: AppModeProviderProps) {
  const [mode, setMode] = useState<AppMode>(defaultMode)

  return <AppModeContext.Provider value={{ mode, setMode }}>{children}</AppModeContext.Provider>
}

export function useAppMode() {
  const context = useContext(AppModeContext)
  if (!context) {
    throw new Error('useAppMode must be used within an AppModeProvider')
  }
  return context
}
