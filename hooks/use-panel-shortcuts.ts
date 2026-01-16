'use client'

import { useEffect } from 'react'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'

export function usePanelShortcuts() {
  const { toggleListPanel, toggleCanvasPanel } = usePanelLayout()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+B or Ctrl+B: Toggle list panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggleListPanel()
      }
      // Cmd+\ or Ctrl+\: Toggle canvas panel
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleCanvasPanel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleListPanel, toggleCanvasPanel])
}
