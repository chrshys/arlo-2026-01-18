# Multi-Panel Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a flexible 4-column resizable layout system with mobile navigation support.

**Architecture:** React context provider manages panel state (visibility, sizes) with localStorage persistence. Desktop uses react-resizable-panels for drag-to-resize. Mobile uses a navigation stack with push/overlay transitions. AppShell component provides compound component API for page content.

**Tech Stack:** react-resizable-panels, React Context, localStorage, Tailwind CSS, lucide-react icons

**Design Doc:** `docs/plans/2026-01-16-multi-panel-layout-design.md`

---

## Task 1: Install Dependencies

**Step 1: Install react-resizable-panels**

Run:

```bash
pnpm add react-resizable-panels
```

**Step 2: Verify installation**

Run:

```bash
pnpm list react-resizable-panels
```

Expected: Shows react-resizable-panels in dependencies

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add react-resizable-panels dependency"
```

---

## Task 2: Create Panel Layout Types

**Files:**

- Create: `types/panel-layout.ts`

**Step 1: Create types file**

```typescript
// types/panel-layout.ts

export type PanelId = 'nav' | 'list' | 'focus' | 'canvas'

export type ContentMaxWidth = 'narrow' | 'medium' | 'wide' | 'full'

export interface PanelLayoutState {
  listPanelVisible: boolean
  canvasPanelVisible: boolean
  listPanelSize: number // percentage
  canvasPanelSize: number // percentage
}

export interface MobileNavigationState {
  stack: PanelId[]
  overlayPanel: PanelId | null
}

export interface PanelLayoutContextValue {
  // Desktop layout state
  layout: PanelLayoutState
  setListPanelVisible: (visible: boolean) => void
  setCanvasPanelVisible: (visible: boolean) => void
  toggleListPanel: () => void
  toggleCanvasPanel: () => void
  setListPanelSize: (size: number) => void
  setCanvasPanelSize: (size: number) => void

  // Mobile navigation
  mobile: MobileNavigationState
  isMobile: boolean
  pushPanel: (panel: PanelId) => void
  popPanel: () => void
  showOverlay: (panel: PanelId) => void
  hideOverlay: () => void

  // Current active panel (for mobile)
  activePanel: PanelId
}

export const DEFAULT_LAYOUT: PanelLayoutState = {
  listPanelVisible: true,
  canvasPanelVisible: false,
  listPanelSize: 20, // percentage
  canvasPanelSize: 25, // percentage
}

export const CONTENT_MAX_WIDTHS: Record<ContentMaxWidth, string> = {
  narrow: '600px',
  medium: '800px',
  wide: '1200px',
  full: '100%',
}
```

**Step 2: Commit**

```bash
git add types/panel-layout.ts
git commit -m "feat: add panel layout types"
```

---

## Task 3: Create Panel Layout Provider

**Files:**

- Create: `components/providers/panel-layout-provider.tsx`

**Step 1: Create the provider**

```tsx
// components/providers/panel-layout-provider.tsx
'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import {
  type PanelLayoutContextValue,
  type PanelLayoutState,
  type MobileNavigationState,
  type PanelId,
  DEFAULT_LAYOUT,
} from '@/types/panel-layout'

const STORAGE_KEY = 'arlo-panel-layout'
const MOBILE_BREAKPOINT = 768

const PanelLayoutContext = createContext<PanelLayoutContextValue | null>(null)

function loadLayoutFromStorage(): PanelLayoutState {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_LAYOUT, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_LAYOUT
}

function saveLayoutToStorage(layout: PanelLayoutState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Ignore storage errors
  }
}

interface PanelLayoutProviderProps {
  children: ReactNode
}

export function PanelLayoutProvider({ children }: PanelLayoutProviderProps) {
  const [layout, setLayout] = useState<PanelLayoutState>(DEFAULT_LAYOUT)
  const [mobile, setMobile] = useState<MobileNavigationState>({
    stack: ['focus'],
    overlayPanel: null,
  })
  const [isMobile, setIsMobile] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate from localStorage after mount
  useEffect(() => {
    setLayout(loadLayoutFromStorage())
    setIsHydrated(true)
  }, [])

  // Save to localStorage when layout changes (debounced)
  useEffect(() => {
    if (!isHydrated) return
    const timeout = setTimeout(() => {
      saveLayoutToStorage(layout)
    }, 300)
    return () => clearTimeout(timeout)
  }, [layout, isHydrated])

  // Track viewport size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Desktop layout actions
  const setListPanelVisible = useCallback((visible: boolean) => {
    setLayout((prev) => ({ ...prev, listPanelVisible: visible }))
  }, [])

  const setCanvasPanelVisible = useCallback((visible: boolean) => {
    setLayout((prev) => ({ ...prev, canvasPanelVisible: visible }))
  }, [])

  const toggleListPanel = useCallback(() => {
    setLayout((prev) => ({ ...prev, listPanelVisible: !prev.listPanelVisible }))
  }, [])

  const toggleCanvasPanel = useCallback(() => {
    setLayout((prev) => ({ ...prev, canvasPanelVisible: !prev.canvasPanelVisible }))
  }, [])

  const setListPanelSize = useCallback((size: number) => {
    setLayout((prev) => ({ ...prev, listPanelSize: size }))
  }, [])

  const setCanvasPanelSize = useCallback((size: number) => {
    setLayout((prev) => ({ ...prev, canvasPanelSize: size }))
  }, [])

  // Mobile navigation actions
  const pushPanel = useCallback((panel: PanelId) => {
    setMobile((prev) => ({
      ...prev,
      stack: [...prev.stack, panel],
    }))
  }, [])

  const popPanel = useCallback(() => {
    setMobile((prev) => ({
      ...prev,
      stack: prev.stack.length > 1 ? prev.stack.slice(0, -1) : prev.stack,
    }))
  }, [])

  const showOverlay = useCallback((panel: PanelId) => {
    setMobile((prev) => ({ ...prev, overlayPanel: panel }))
  }, [])

  const hideOverlay = useCallback(() => {
    setMobile((prev) => ({ ...prev, overlayPanel: null }))
  }, [])

  const activePanel = mobile.stack[mobile.stack.length - 1]

  const value = useMemo<PanelLayoutContextValue>(
    () => ({
      layout,
      setListPanelVisible,
      setCanvasPanelVisible,
      toggleListPanel,
      toggleCanvasPanel,
      setListPanelSize,
      setCanvasPanelSize,
      mobile,
      isMobile,
      pushPanel,
      popPanel,
      showOverlay,
      hideOverlay,
      activePanel,
    }),
    [
      layout,
      setListPanelVisible,
      setCanvasPanelVisible,
      toggleListPanel,
      toggleCanvasPanel,
      setListPanelSize,
      setCanvasPanelSize,
      mobile,
      isMobile,
      pushPanel,
      popPanel,
      showOverlay,
      hideOverlay,
      activePanel,
    ]
  )

  return <PanelLayoutContext.Provider value={value}>{children}</PanelLayoutContext.Provider>
}

export function usePanelLayout(): PanelLayoutContextValue {
  const context = useContext(PanelLayoutContext)
  if (!context) {
    throw new Error('usePanelLayout must be used within PanelLayoutProvider')
  }
  return context
}
```

**Step 2: Commit**

```bash
git add components/providers/panel-layout-provider.tsx
git commit -m "feat: add panel layout provider with localStorage persistence"
```

---

## Task 4: Create Keyboard Shortcuts Hook

**Files:**

- Create: `hooks/use-panel-shortcuts.ts`

**Step 1: Create the hook**

```typescript
// hooks/use-panel-shortcuts.ts
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
```

**Step 2: Commit**

```bash
git add hooks/use-panel-shortcuts.ts
git commit -m "feat: add keyboard shortcuts hook for panel toggling"
```

---

## Task 5: Create Resize Handle Component

**Files:**

- Create: `components/layout/ResizeHandle.tsx`

**Step 1: Create the component**

```tsx
// components/layout/ResizeHandle.tsx
'use client'

import { PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  className?: string
  id?: string
}

export function ResizeHandle({ className, id }: ResizeHandleProps) {
  return (
    <PanelResizeHandle
      id={id}
      className={cn(
        'group relative w-1 bg-transparent hover:bg-primary/10 transition-colors',
        'data-[resize-handle-active]:bg-primary/20',
        className
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border',
          'group-hover:w-0.5 group-hover:bg-primary/50',
          'group-data-[resize-handle-active]:w-0.5 group-data-[resize-handle-active]:bg-primary'
        )}
      />
    </PanelResizeHandle>
  )
}
```

**Step 2: Commit**

```bash
git add components/layout/ResizeHandle.tsx
git commit -m "feat: add styled resize handle component"
```

---

## Task 6: Create Panel Header Component

**Files:**

- Create: `components/layout/PanelHeader.tsx`

**Step 1: Create the component**

```tsx
// components/layout/PanelHeader.tsx
'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PanelHeaderProps {
  children: ReactNode
  className?: string
}

export function PanelHeader({ children, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'h-12 px-4 flex items-center justify-between border-b border-border shrink-0',
        className
      )}
    >
      {children}
    </div>
  )
}

interface PanelHeaderTitleProps {
  children: ReactNode
  className?: string
}

function PanelHeaderTitle({ children, className }: PanelHeaderTitleProps) {
  return <h2 className={cn('font-semibold text-sm', className)}>{children}</h2>
}

interface PanelHeaderActionsProps {
  children: ReactNode
  className?: string
}

function PanelHeaderActions({ children, className }: PanelHeaderActionsProps) {
  return <div className={cn('flex items-center gap-1', className)}>{children}</div>
}

PanelHeader.Title = PanelHeaderTitle
PanelHeader.Actions = PanelHeaderActions
```

**Step 2: Commit**

```bash
git add components/layout/PanelHeader.tsx
git commit -m "feat: add panel header compound component"
```

---

## Task 7: Create Icon Rail Component

**Files:**

- Create: `components/layout/IconRail.tsx`

**Step 1: Create the component**

```tsx
// components/layout/IconRail.tsx
'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Home, MessageSquare, CheckSquare, FileText, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface IconRailProps {
  className?: string
}

interface NavItem {
  id: string
  icon: ReactNode
  label: string
  href?: string
  onClick?: () => void
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: <Home className="h-5 w-5" />, label: 'Home' },
  { id: 'chat', icon: <MessageSquare className="h-5 w-5" />, label: 'Chat' },
  { id: 'tasks', icon: <CheckSquare className="h-5 w-5" />, label: 'Tasks' },
  { id: 'docs', icon: <FileText className="h-5 w-5" />, label: 'Documents' },
]

export function IconRail({ className }: IconRailProps) {
  return (
    <div className={cn('flex flex-col h-full bg-muted/40', className)}>
      {/* Main nav items */}
      <nav className="flex-1 flex flex-col items-center py-2 gap-1">
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title={item.label}
          >
            {item.icon}
          </Button>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="flex flex-col items-center py-2 border-t border-border">
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/layout/IconRail.tsx
git commit -m "feat: add icon rail navigation component"
```

---

## Task 8: Create App Header Component

**Files:**

- Create: `components/layout/AppHeader.tsx`

**Step 1: Create the component**

```tsx
// components/layout/AppHeader.tsx
'use client'

import { Menu, Settings, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface AppHeaderProps {
  className?: string
}

export function AppHeader({ className }: AppHeaderProps) {
  const { isMobile, mobile, popPanel } = usePanelLayout()

  const canGoBack = mobile.stack.length > 1

  return (
    <header
      className={cn(
        'h-14 px-4 flex items-center gap-4 border-b border-border bg-background shrink-0',
        className
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-2">
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={canGoBack ? popPanel : undefined}
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : (
          <span className="font-bold text-lg">Arlo</span>
        )}
      </div>

      {/* Command bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ask Arlo anything..."
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
          <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href="/settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
```

**Step 2: Commit**

```bash
git add components/layout/AppHeader.tsx
git commit -m "feat: add app header with command bar"
```

---

## Task 9: Create Desktop Panel Layout

**Files:**

- Create: `components/layout/DesktopPanelLayout.tsx`

**Step 1: Create the component**

```tsx
// components/layout/DesktopPanelLayout.tsx
'use client'

import { type ReactNode } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { ResizeHandle } from './ResizeHandle'
import { IconRail } from './IconRail'
import { cn } from '@/lib/utils'

interface DesktopPanelLayoutProps {
  listPanel?: ReactNode
  focusPanel?: ReactNode
  canvasPanel?: ReactNode
}

export function DesktopPanelLayout({
  listPanel,
  focusPanel,
  canvasPanel,
}: DesktopPanelLayoutProps) {
  const { layout, setListPanelSize, setCanvasPanelSize } = usePanelLayout()

  return (
    <PanelGroup direction="horizontal" className="h-full" autoSaveId="arlo-panel-layout">
      {/* Icon Rail - fixed width */}
      <Panel defaultSize={4} minSize={3} maxSize={5} className="min-w-[48px] max-w-[64px]">
        <IconRail />
      </Panel>

      <ResizeHandle />

      {/* List Panel - collapsible */}
      {layout.listPanelVisible && listPanel && (
        <>
          <Panel
            defaultSize={layout.listPanelSize}
            minSize={10}
            maxSize={30}
            onResize={setListPanelSize}
            className="min-w-[150px] max-w-[400px]"
          >
            <div className="h-full border-r border-border bg-background">{listPanel}</div>
          </Panel>
          <ResizeHandle />
        </>
      )}

      {/* Focus Panel - always visible, takes remaining space */}
      <Panel minSize={30}>
        <div className="h-full bg-background">{focusPanel}</div>
      </Panel>

      {/* Canvas Panel - collapsible */}
      {layout.canvasPanelVisible && canvasPanel && (
        <>
          <ResizeHandle />
          <Panel
            defaultSize={layout.canvasPanelSize}
            minSize={15}
            maxSize={40}
            onResize={setCanvasPanelSize}
            className="min-w-[250px] max-w-[600px]"
          >
            <div className="h-full border-l border-border bg-background">{canvasPanel}</div>
          </Panel>
        </>
      )}
    </PanelGroup>
  )
}
```

**Step 2: Commit**

```bash
git add components/layout/DesktopPanelLayout.tsx
git commit -m "feat: add desktop panel layout with resizable panels"
```

---

## Task 10: Create Mobile Layout

**Files:**

- Create: `components/layout/MobileLayout.tsx`

**Step 1: Create the component**

```tsx
// components/layout/MobileLayout.tsx
'use client'

import { type ReactNode } from 'react'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileLayoutProps {
  navPanel?: ReactNode
  listPanel?: ReactNode
  focusPanel?: ReactNode
  canvasPanel?: ReactNode
}

export function MobileLayout({ navPanel, listPanel, focusPanel, canvasPanel }: MobileLayoutProps) {
  const { activePanel, mobile, hideOverlay } = usePanelLayout()

  const renderPanel = () => {
    switch (activePanel) {
      case 'nav':
        return navPanel
      case 'list':
        return listPanel
      case 'focus':
        return focusPanel
      case 'canvas':
        return canvasPanel
      default:
        return focusPanel
    }
  }

  return (
    <div className="h-full relative">
      {/* Main content */}
      <div className="h-full">{renderPanel()}</div>

      {/* Overlay panel (canvas as sheet) */}
      {mobile.overlayPanel && (
        <>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 z-40" onClick={hideOverlay} />

          {/* Sheet */}
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 z-50 bg-background rounded-t-xl',
              'max-h-[85vh] flex flex-col',
              'animate-in slide-in-from-bottom duration-300'
            )}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold">Canvas</span>
              <Button variant="ghost" size="icon" onClick={hideOverlay}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Sheet content */}
            <div className="flex-1 overflow-auto">
              {mobile.overlayPanel === 'canvas' && canvasPanel}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/layout/MobileLayout.tsx
git commit -m "feat: add mobile layout with navigation stack and overlay"
```

---

## Task 11: Create AppShell Component

**Files:**

- Create: `components/layout/AppShell.tsx`

**Step 1: Create the component**

```tsx
// components/layout/AppShell.tsx
'use client'

import { type ReactNode, createContext, useContext } from 'react'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { usePanelShortcuts } from '@/hooks/use-panel-shortcuts'
import { AppHeader } from './AppHeader'
import { DesktopPanelLayout } from './DesktopPanelLayout'
import { MobileLayout } from './MobileLayout'
import { cn } from '@/lib/utils'
import { type ContentMaxWidth, CONTENT_MAX_WIDTHS } from '@/types/panel-layout'

// Context to collect panel content
interface AppShellContextValue {
  registerPanel: (id: string, content: ReactNode) => void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  const { isMobile } = usePanelLayout()

  // Enable keyboard shortcuts
  usePanelShortcuts()

  return (
    <div className={cn('h-screen flex flex-col', className)}>
      <AppHeader />
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}

// Panel wrapper components
interface PanelProps {
  children: ReactNode
  className?: string
}

function ListPanel({ children, className }: PanelProps) {
  return <div className={cn('h-full flex flex-col', className)}>{children}</div>
}

interface FocusPanelProps extends PanelProps {
  contentMaxWidth?: ContentMaxWidth
}

function FocusPanel({ children, className, contentMaxWidth = 'full' }: FocusPanelProps) {
  const maxWidth = CONTENT_MAX_WIDTHS[contentMaxWidth]

  return (
    <div className={cn('h-full flex flex-col', className)}>
      <div className="flex-1 min-h-0 mx-auto w-full" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  )
}

function CanvasPanel({ children, className }: PanelProps) {
  return <div className={cn('h-full flex flex-col', className)}>{children}</div>
}

// Layout component that arranges panels
interface LayoutProps {
  list?: ReactNode
  focus?: ReactNode
  canvas?: ReactNode
}

function Layout({ list, focus, canvas }: LayoutProps) {
  const { isMobile } = usePanelLayout()

  if (isMobile) {
    return <MobileLayout listPanel={list} focusPanel={focus} canvasPanel={canvas} />
  }

  return <DesktopPanelLayout listPanel={list} focusPanel={focus} canvasPanel={canvas} />
}

AppShell.List = ListPanel
AppShell.Focus = FocusPanel
AppShell.Canvas = CanvasPanel
AppShell.Layout = Layout
```

**Step 2: Commit**

```bash
git add components/layout/AppShell.tsx
git commit -m "feat: add AppShell compound component"
```

---

## Task 12: Create Layout Index Export

**Files:**

- Create: `components/layout/index.ts`

**Step 1: Create barrel export**

```typescript
// components/layout/index.ts
export { AppShell } from './AppShell'
export { AppHeader } from './AppHeader'
export { PanelHeader } from './PanelHeader'
export { IconRail } from './IconRail'
export { ResizeHandle } from './ResizeHandle'
export { DesktopPanelLayout } from './DesktopPanelLayout'
export { MobileLayout } from './MobileLayout'
```

**Step 2: Commit**

```bash
git add components/layout/index.ts
git commit -m "feat: add layout components barrel export"
```

---

## Task 13: Add Provider to Root Layout

**Files:**

- Modify: `app/layout.tsx`

**Step 1: Update layout to include PanelLayoutProvider**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { ConvexClientProvider } from '@/components/ConvexProvider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PanelLayoutProvider } from '@/components/providers/panel-layout-provider'

export const metadata: Metadata = {
  title: 'Arlo',
  description: 'Your personal AI assistant',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <ConvexClientProvider>
            <PanelLayoutProvider>{children}</PanelLayoutProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add PanelLayoutProvider to root layout"
```

---

## Task 14: Migrate Home Page to AppShell

**Files:**

- Modify: `app/page.tsx`

**Step 1: Update page to use new layout system**

```tsx
// app/page.tsx
'use client'

import { useState } from 'react'
import { Chat } from '@/components/Chat'
import { TaskList } from '@/components/TaskList'
import { AppShell, PanelHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function Home() {
  const [threadId, setThreadId] = useState<string | null>(null)

  return (
    <AppShell>
      <AppShell.Layout
        list={
          <AppShell.List>
            <PanelHeader>
              <PanelHeader.Title>Conversations</PanelHeader.Title>
              <PanelHeader.Actions>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </PanelHeader.Actions>
            </PanelHeader>
            <div className="flex-1 overflow-auto p-2">
              <div className="text-sm text-muted-foreground p-2">Chat history will appear here</div>
            </div>
          </AppShell.List>
        }
        focus={
          <AppShell.Focus contentMaxWidth="narrow">
            <Chat threadId={threadId} onThreadCreated={setThreadId} />
          </AppShell.Focus>
        }
        canvas={
          <AppShell.Canvas>
            <PanelHeader>
              <PanelHeader.Title>Tasks</PanelHeader.Title>
            </PanelHeader>
            <div className="flex-1 overflow-auto">
              <TaskList />
            </div>
          </AppShell.Canvas>
        }
      />
    </AppShell>
  )
}
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: migrate home page to AppShell layout"
```

---

## Task 15: Run Type Check and Fix Issues

**Step 1: Run type check**

Run:

```bash
pnpm typecheck
```

**Step 2: Fix any type errors that arise**

(Address errors as needed based on output)

**Step 3: Run lint**

Run:

```bash
pnpm lint:fix
```

**Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve type and lint errors"
```

---

## Task 16: Manual Testing Checklist

**Step 1: Start dev server**

Run:

```bash
pnpm dev
```

**Step 2: Test desktop layout**

- [ ] App loads with icon rail, focus panel visible
- [ ] Cmd+B toggles list panel
- [ ] Cmd+\ toggles canvas panel
- [ ] Panels resize via drag handles
- [ ] Panel sizes persist after page refresh

**Step 3: Test mobile layout**

- [ ] Resize browser below 768px
- [ ] Layout switches to single column
- [ ] Navigation works via hamburger menu

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: complete multi-panel layout implementation"
```

---

## Summary

This plan creates a flexible 4-column layout system:

1. **Types** - Shared type definitions
2. **Provider** - State management with localStorage persistence
3. **Hooks** - Keyboard shortcuts
4. **Components** - ResizeHandle, PanelHeader, IconRail, AppHeader
5. **Layouts** - DesktopPanelLayout, MobileLayout, AppShell
6. **Integration** - Updated root layout and home page

The AppShell provides a clean API:

```tsx
<AppShell>
  <AppShell.Layout list={<ListContent />} focus={<MainContent />} canvas={<SideContent />} />
</AppShell>
```
