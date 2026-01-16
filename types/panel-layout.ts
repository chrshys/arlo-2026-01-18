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
