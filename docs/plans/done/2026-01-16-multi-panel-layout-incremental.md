# Multi-Panel Layout - Incremental Implementation

**Goal:** Build a flexible 4-column resizable layout system, one panel at a time with visible results after each phase.

**Branch:** `feature/multi-panel-layout`

**Design Doc:** `docs/plans/2026-01-16-multi-panel-layout-design.md`

---

## Phase 1: Foundation + Minimal Shell

**Testable result:** App still works, minimal visual shell wrapper in place

### Task 1.1: Create branch and install dependencies

```bash
git checkout -b feature/multi-panel-layout
pnpm add react-resizable-panels
```

### Task 1.2: Create panel layout types

Create `types/panel-layout.ts`:

```typescript
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
  listPanelSize: 20,
  canvasPanelSize: 25,
}

export const CONTENT_MAX_WIDTHS: Record<ContentMaxWidth, string> = {
  narrow: '600px',
  medium: '800px',
  wide: '1200px',
  full: '100%',
}
```

### Task 1.3: Create panel layout provider

Create `components/providers/panel-layout-provider.tsx` (full implementation from original plan)

### Task 1.4: Create minimal AppShell

Create `components/layout/AppShell.tsx`:

```tsx
'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  return <div className={cn('h-screen flex flex-col', className)}>{children}</div>
}
```

Create `components/layout/index.ts`:

```typescript
export { AppShell } from './AppShell'
```

### Task 1.5: Wire up provider to root layout

Update `app/layout.tsx` to include `PanelLayoutProvider`.

### Task 1.6: Wrap existing page in AppShell

Update `app/page.tsx` to use `<AppShell>` wrapper (keep existing content).

### Task 1.7: Test and commit

```bash
pnpm check
pnpm dev
# Verify app still works identically
git add -A && git commit -m "feat: add panel layout foundation and minimal AppShell"
```

---

## Phase 2: Icon Rail Panel

**Testable result:** Icon rail visible on left side of screen

### Task 2.1: Create IconRail component

Create `components/layout/IconRail.tsx`:

```tsx
'use client'

import { Home, MessageSquare, CheckSquare, FileText, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface IconRailProps {
  className?: string
}

export function IconRail({ className }: IconRailProps) {
  return (
    <div className={cn('flex flex-col h-full w-12 bg-muted/40 border-r border-border', className)}>
      <nav className="flex-1 flex flex-col items-center py-2 gap-1">
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Home">
          <Home className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Chat">
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Tasks">
          <CheckSquare className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Documents">
          <FileText className="h-5 w-5" />
        </Button>
      </nav>
      <div className="flex flex-col items-center py-2 border-t border-border">
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
```

### Task 2.2: Update AppShell to show IconRail

Update `components/layout/AppShell.tsx`:

```tsx
'use client'

import { type ReactNode } from 'react'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { IconRail } from './IconRail'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  const { isMobile } = usePanelLayout()

  return (
    <div className={cn('h-screen flex', className)}>
      {!isMobile && <IconRail />}
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  )
}
```

Update `components/layout/index.ts` to export IconRail.

### Task 2.3: Test and commit

```bash
pnpm check
pnpm dev
# Verify: Icon rail appears on left, existing content on right
git add -A && git commit -m "feat: add icon rail navigation panel"
```

---

## Phase 3: App Header

**Testable result:** Header with command bar at top

### Task 3.1: Create AppHeader component

Create `components/layout/AppHeader.tsx`:

```tsx
'use client'

import { Settings, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface AppHeaderProps {
  className?: string
}

export function AppHeader({ className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'h-14 px-4 flex items-center gap-4 border-b border-border bg-background shrink-0',
        className
      )}
    >
      <span className="font-bold text-lg">Arlo</span>

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

### Task 3.2: Add AppHeader to AppShell

Update `components/layout/AppShell.tsx` to include `<AppHeader />` in the main content area.

### Task 3.3: Test and commit

```bash
pnpm check
pnpm dev
# Verify: Header with search bar at top, icon rail on left
git add -A && git commit -m "feat: add app header with command bar"
```

---

## Phase 4: List Panel with Resize

**Testable result:** Resizable list panel appears between icon rail and main content

### Task 4.1: Create ResizeHandle component

Create `components/layout/ResizeHandle.tsx`:

```tsx
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

### Task 4.2: Create PanelHeader component

Create `components/layout/PanelHeader.tsx`:

```tsx
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

function PanelHeaderTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('font-semibold text-sm', className)}>{children}</h2>
}

function PanelHeaderActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-1', className)}>{children}</div>
}

PanelHeader.Title = PanelHeaderTitle
PanelHeader.Actions = PanelHeaderActions
```

### Task 4.3: Create DesktopPanelLayout with list panel

Create `components/layout/DesktopPanelLayout.tsx`:

```tsx
'use client'

import { type ReactNode } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { usePanelLayout } from '@/components/providers/panel-layout-provider'
import { ResizeHandle } from './ResizeHandle'
import { cn } from '@/lib/utils'

interface DesktopPanelLayoutProps {
  listPanel?: ReactNode
  focusPanel: ReactNode
}

export function DesktopPanelLayout({ listPanel, focusPanel }: DesktopPanelLayoutProps) {
  const { layout, setListPanelSize } = usePanelLayout()

  return (
    <PanelGroup direction="horizontal" className="h-full">
      {layout.listPanelVisible && listPanel && (
        <>
          <Panel
            defaultSize={layout.listPanelSize}
            minSize={15}
            maxSize={35}
            onResize={setListPanelSize}
          >
            <div className="h-full border-r border-border bg-background">{listPanel}</div>
          </Panel>
          <ResizeHandle />
        </>
      )}
      <Panel minSize={30}>
        <div className="h-full bg-background">{focusPanel}</div>
      </Panel>
    </PanelGroup>
  )
}
```

### Task 4.4: Update AppShell to use DesktopPanelLayout

Add compound components and Layout to AppShell. Update page.tsx to use the list panel.

### Task 4.5: Add keyboard shortcut for list panel

Create `hooks/use-panel-shortcuts.ts` with Cmd+B toggle.

### Task 4.6: Test and commit

```bash
pnpm check
pnpm dev
# Verify:
# - List panel visible with "Conversations" header
# - Drag handle to resize
# - Cmd+B toggles list panel
# - Size persists on refresh
git add -A && git commit -m "feat: add resizable list panel with keyboard shortcut"
```

---

## Phase 5: Canvas Panel

**Testable result:** Canvas panel on right side with tasks

### Task 5.1: Update DesktopPanelLayout to include canvas panel

Add canvas panel support to `DesktopPanelLayout.tsx`.

### Task 5.2: Add Cmd+\ shortcut for canvas panel

Update `hooks/use-panel-shortcuts.ts`.

### Task 5.3: Update page.tsx to include canvas content

Add TaskList to canvas panel.

### Task 5.4: Test and commit

```bash
pnpm check
pnpm dev
# Verify:
# - Cmd+\ toggles canvas panel
# - Canvas shows tasks
# - All three panels resize independently
# - Sizes persist
git add -A && git commit -m "feat: add resizable canvas panel with tasks"
```

---

## Phase 6: Focus Panel Improvements

**Testable result:** Chat content properly constrained with max-width

### Task 6.1: Add FocusPanel with contentMaxWidth support

Update AppShell compound components to support contentMaxWidth prop.

### Task 6.2: Update page.tsx to use narrow max-width

Set `contentMaxWidth="narrow"` on chat area.

### Task 6.3: Test and commit

```bash
pnpm check
pnpm dev
# Verify: Chat content is centered and constrained to ~600px
git add -A && git commit -m "feat: add content max-width support to focus panel"
```

---

## Phase 7: Mobile Layout

**Testable result:** Single-column layout on mobile with navigation

### Task 7.1: Create MobileLayout component

Create `components/layout/MobileLayout.tsx` with navigation stack and overlay support.

### Task 7.2: Update AppShell to conditionally render mobile/desktop

Switch between layouts based on `isMobile`.

### Task 7.3: Update AppHeader for mobile

Add hamburger menu and back button on mobile.

### Task 7.4: Test and commit

```bash
pnpm check
pnpm dev
# Verify:
# - Resize browser < 768px
# - Single column layout
# - Navigation between panels
git add -A && git commit -m "feat: add mobile layout with navigation stack"
```

---

## Phase 8: Final Polish and PR

**Testable result:** Complete, polished implementation

### Task 8.1: Run full test suite

```bash
pnpm check
pnpm test:run
```

### Task 8.2: Manual testing checklist

Desktop:

- [ ] Icon rail visible
- [ ] Cmd+B toggles list panel
- [ ] Cmd+\ toggles canvas panel
- [ ] Panels resize via drag
- [ ] Sizes persist after refresh
- [ ] Chat constrained to narrow width

Mobile:

- [ ] Layout switches at 768px breakpoint
- [ ] Single column view
- [ ] Navigation works

### Task 8.3: Create PR

```bash
git push -u origin feature/multi-panel-layout
gh pr create --title "feat: add multi-panel layout system" --body "..."
```

---

## Summary

| Phase | What's Added               | Visual Result                        |
| ----- | -------------------------- | ------------------------------------ |
| 1     | Foundation + minimal shell | App works, no visual change          |
| 2     | Icon rail                  | Left sidebar with icons              |
| 3     | App header                 | Top bar with search                  |
| 4     | List panel                 | Resizable sidebar, Cmd+B toggle      |
| 5     | Canvas panel               | Right panel with tasks, Cmd+\ toggle |
| 6     | Focus improvements         | Chat constrained to readable width   |
| 7     | Mobile layout              | Responsive single-column             |
| 8     | Polish + PR                | Complete feature                     |
