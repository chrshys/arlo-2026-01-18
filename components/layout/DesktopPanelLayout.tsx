'use client'

import { type ReactNode } from 'react'
import { Group, Panel } from 'react-resizable-panels'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { ResizeHandle } from './ResizeHandle'

interface DesktopPanelLayoutProps {
  listPanel?: ReactNode
  focusPanel: ReactNode
}

export function DesktopPanelLayout({ listPanel, focusPanel }: DesktopPanelLayoutProps) {
  const { layout, setListPanelSize } = usePanelLayout()

  return (
    <Group orientation="horizontal" className="h-full">
      {layout.listPanelVisible && listPanel && (
        <>
          <Panel
            id="list"
            defaultSize={layout.listPanelSize}
            minSize={15}
            maxSize={35}
            onResize={(size) => {
              setListPanelSize(size.asPercentage)
            }}
          >
            <div className="h-full border-r border-border bg-background">{listPanel}</div>
          </Panel>
          <ResizeHandle />
        </>
      )}
      <Panel id="focus" minSize={30}>
        <div className="h-full bg-background">{focusPanel}</div>
      </Panel>
    </Group>
  )
}
