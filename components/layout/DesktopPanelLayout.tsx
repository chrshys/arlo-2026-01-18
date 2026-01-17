'use client'

import { type ReactNode, useState, useEffect, useCallback } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { usePanelShortcuts } from '@/hooks/use-panel-shortcuts'
import { PANEL_SIZES } from '@/types/panel-layout'

// Shared storage key - panel sizes sync across views since IDs match
const STORAGE_KEY = 'arlo-panel-sizes'

type PanelSizes = Record<string, number>

function loadSizes(): PanelSizes | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // Ignore parse errors
  }
  return undefined
}

function saveSizes(sizes: PanelSizes): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
  } catch {
    // Ignore storage errors
  }
}

interface DesktopPanelLayoutProps {
  listPanel?: ReactNode
  focusPanel: ReactNode
  canvasPanel?: ReactNode
}

export function DesktopPanelLayout({
  listPanel,
  focusPanel,
  canvasPanel,
}: DesktopPanelLayoutProps) {
  const { layout } = usePanelLayout()
  usePanelShortcuts()

  const [savedSizes, setSavedSizes] = useState<PanelSizes | undefined>(undefined)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setSavedSizes(loadSizes())
    setIsHydrated(true)
  }, [])

  const handleLayoutChanged = useCallback((newLayout: PanelSizes) => {
    saveSizes(newLayout)
    setSavedSizes(newLayout)
  }, [])

  const showList = listPanel && layout.listPanelVisible
  const showCanvas = canvasPanel && layout.canvasPanelVisible

  // Wait for hydration to avoid layout shift
  if (!isHydrated) {
    return <div className="h-full w-full bg-background" />
  }

  // Neither list nor canvas visible
  if (!showList && !showCanvas) {
    return <div className="h-full w-full bg-background">{focusPanel}</div>
  }

  return (
    <Group
      id="panels"
      orientation="horizontal"
      className="h-full w-full"
      defaultLayout={savedSizes}
      onLayoutChanged={handleLayoutChanged}
    >
      {showList && (
        <>
          <Panel
            id="sidebar"
            defaultSize={PANEL_SIZES.sidebar.default}
            minSize={PANEL_SIZES.sidebar.min}
            maxSize={PANEL_SIZES.sidebar.max}
          >
            <div className="h-full w-full bg-background">{listPanel}</div>
          </Panel>
          <Separator className="w-1 bg-border hover:bg-primary/50 cursor-col-resize outline-none" />
        </>
      )}
      <Panel id="main" minSize={PANEL_SIZES.main.min}>
        <div className="h-full w-full bg-background">{focusPanel}</div>
      </Panel>
      {showCanvas && (
        <>
          <Separator className="w-1 bg-border hover:bg-primary/50 cursor-col-resize outline-none" />
          <Panel
            id="detail"
            defaultSize={PANEL_SIZES.detail.default}
            minSize={PANEL_SIZES.detail.min}
            maxSize={PANEL_SIZES.detail.max}
          >
            <div className="h-full w-full bg-background border-l border-border">{canvasPanel}</div>
          </Panel>
        </>
      )}
    </Group>
  )
}
