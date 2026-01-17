# Multi-Panel Layout Design

## Overview

A flexible, resizable 4-column layout system for Arlo, inspired by Slack and VS Code. Supports desktop multi-panel views and mobile navigation with push/overlay paradigm.

## Layout Structure

### Desktop (4-column)

```
┌──────────────────────────────────────────────────────────────────┐
│  [≡] [Logo]        [ Ask Arlo anything... ]           [⚙️] [👤] │  ← App Header (command bar)
├────┬─────────────┬────────────────────────┬──────────────────────┤
│    │ Panel 2     │ Panel 3                │ Panel 4              │
│ 🏠 │ Header      │ Header                 │ Header               │
│ 💬 ├─────────────┼────────────────────────┼──────────────────────┤
│ 📋 │             │                        │                      │
│ 📄 │ List        │ Focus/Chat             │ Canvas               │
│    │ Content     │ Content                │ Content              │
│ ⚙️ │             │                        │                      │
├────┴─────────────┴────────────────────────┴──────────────────────┤
│ Icon   Resizable      Resizable (primary)     Resizable          │
│ Rail   ~200-300px     flex-1                  ~300-500px         │
└──────────────────────────────────────────────────────────────────┘
```

### Panel Specifications

| Panel | Name      | Width                    | Behavior                                                       |
| ----- | --------- | ------------------------ | -------------------------------------------------------------- |
| 1     | Icon Rail | Fixed 48-64px            | Always visible on desktop, hidden on mobile (hamburger access) |
| 2     | List      | 150-400px, default 250px | Resizable, collapsible                                         |
| 3     | Focus     | Remaining space (flex-1) | Primary content, never collapses                               |
| 4     | Canvas    | 250-600px, default 350px | Resizable, collapsible                                         |

### Focus Panel Content Constraints

The Focus panel container takes all remaining space, but content within can be constrained:

| Mode   | Max Width | Use Case            |
| ------ | --------- | ------------------- |
| narrow | 600px     | Chat, forms         |
| medium | 800px     | Documents, articles |
| wide   | 1200px    | Tables, dashboards  |
| full   | 100%      | Galleries, canvases |

Content is horizontally centered when constrained.

## Mobile Behavior

### Single Column with Navigation Stack

```
┌────────────────────────────┐
│ [≡] [Title/Breadcrumb] [⋮] │  ← App Header (contextual)
├────────────────────────────┤
│                            │
│    Current Panel           │
│    (full screen)           │
│                            │
└────────────────────────────┘
```

### Navigation Paradigm

- **Default view**: Focus panel is the home state
- **Hamburger [≡]**: Opens nav sidebar as slide-over overlay from left (icon rail + expanded labels)
- **Push navigation**: Nav → List → Focus. Standard back gesture/button to return.
- **Canvas as overlay**: Slides up as sheet/modal. Dismissible. For previews and auxiliary content.

### Breakpoint

Mobile layout activates below 768px (Tailwind `md` breakpoint).

## App Header (Command Bar)

Spans full width. Contains:

- Hamburger menu (mobile) or logo (desktop)
- Command bar input: "Ask Arlo anything..."
- Global actions: settings, user menu

Keyboard shortcut: `Cmd+K` focuses command bar.

## State Management

### Panel Layout State

```typescript
interface PanelLayoutState {
  // Panel visibility
  listPanelVisible: boolean
  canvasPanelVisible: boolean

  // Panel sizes (pixels)
  listPanelSize: number
  canvasPanelSize: number

  // Mobile navigation stack
  mobileStack: PanelId[]
}
```

### Persistence

- **Storage**: localStorage (`arlo-panel-layout`)
- **Trigger**: Debounced save on resize/collapse
- **Restore**: On app mount with SSR-safe hydration
- **Fallback**: Sensible defaults if no stored state

### Context API

```typescript
const {
  layout, // Current layout state
  togglePanel, // Show/hide list or canvas
  setSize, // Resize a panel
  navigation, // Mobile navigation controls
  isMobile, // Responsive breakpoint state
} = usePanelLayout()
```

### Programmatic Navigation (Mobile)

```typescript
navigation.push('canvas', { documentId: '123' })
navigation.push('list', { filter: 'tasks' })
navigation.overlay('canvas')
navigation.back()
```

## Keyboard Shortcuts

| Shortcut | Action              |
| -------- | ------------------- |
| `Cmd+B`  | Toggle list panel   |
| `Cmd+\`  | Toggle canvas panel |
| `Cmd+K`  | Focus command bar   |

## Component Architecture

### File Structure

```
components/
├── layout/
│   ├── AppShell.tsx           # Root layout wrapper
│   ├── AppHeader.tsx          # Command bar header
│   ├── PanelLayout.tsx        # Desktop panel container
│   ├── MobileLayout.tsx       # Mobile navigation stack
│   ├── IconRail.tsx           # Left nav icons
│   ├── Panel.tsx              # Generic panel wrapper
│   ├── PanelHeader.tsx        # Panel header component
│   └── ResizeHandle.tsx       # Styled drag handle
├── providers/
│   └── panel-layout-provider.tsx
hooks/
├── use-panel-layout.ts
├── use-mobile-navigation.ts
```

### Usage

```tsx
// app/layout.tsx
<AppShell>
  {children}
</AppShell>

// app/page.tsx
<AppShell.List>
  <ChatHistory />
</AppShell.List>

<AppShell.Focus contentMaxWidth="narrow">
  <Chat />
</AppShell.Focus>

<AppShell.Canvas>
  <DocumentPreview />
</AppShell.Canvas>
```

## Dependencies

- `react-resizable-panels` — Panel resizing library (~8kb gzipped)

## Implementation Notes

### Resize Handles

- Default: 4px width
- Hover: 8px width
- Cursor: `col-resize`
- Styled to match design system

### Panel Headers

```tsx
<PanelHeader>
  <PanelHeader.Title>Conversations</PanelHeader.Title>
  <PanelHeader.Actions>
    <Button variant="ghost" size="icon">
      <Plus />
    </Button>
  </PanelHeader.Actions>
</PanelHeader>
```

### SSR Considerations

- Initial render uses default layout
- localStorage state applied after hydration
- Avoid layout shift with CSS defaults matching stored state where possible
