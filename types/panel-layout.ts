export type PanelId = 'nav' | 'list' | 'focus' | 'canvas'

export type ContentMaxWidth = 'narrow' | 'medium' | 'wide' | 'full'

export interface PanelLayoutState {
  listPanelVisible: boolean
  canvasPanelVisible: boolean
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

  // Mobile navigation
  mobile: MobileNavigationState
  isMobile: boolean
  isHydrated: boolean
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
}

// Shared panel size constraints (pixels) for consistent UX across views
export const PANEL_SIZES = {
  sidebar: { default: 240, min: 180, max: 360 },
  main: { min: 400 },
  detail: { default: 320, min: 250, max: 500 },
} as const

export const CONTENT_MAX_WIDTHS: Record<ContentMaxWidth, string> = {
  narrow: '600px',
  medium: '800px',
  wide: '1200px',
  full: '100%',
}
