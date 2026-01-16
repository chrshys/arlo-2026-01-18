'use client'

import { type ReactNode } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { usePanelShortcuts } from '@/hooks/use-panel-shortcuts'

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
  const { layout, setListPanelSize, setCanvasPanelSize } = usePanelLayout()
  usePanelShortcuts()

  const showList = listPanel && layout.listPanelVisible
  const showCanvas = canvasPanel && layout.canvasPanelVisible

  // Neither list nor canvas visible
  if (!showList && !showCanvas) {
    return <div className="h-full w-full bg-background">{focusPanel}</div>
  }

  return (
    <Group orientation="horizontal" className="h-full w-full">
      {showList && (
        <>
          <Panel
            id="list"
            defaultSize={layout.listPanelSize}
            minSize={200}
            maxSize={400}
            onResize={(size) => setListPanelSize(size.inPixels)}
          >
            <div className="h-full w-full bg-background">{listPanel}</div>
          </Panel>
          <Separator className="w-1 bg-border hover:bg-primary/50 cursor-col-resize" />
        </>
      )}
      <Panel id="focus" minSize={400}>
        <div className="h-full w-full bg-background">{focusPanel}</div>
      </Panel>
      {showCanvas && (
        <>
          <Separator className="w-1 bg-border hover:bg-primary/50 cursor-col-resize" />
          <Panel
            id="canvas"
            defaultSize={layout.canvasPanelSize}
            minSize={250}
            maxSize={500}
            onResize={(size) => setCanvasPanelSize(size.inPixels)}
          >
            <div className="h-full w-full bg-background border-l border-border">{canvasPanel}</div>
          </Panel>
        </>
      )}
    </Group>
  )
}
