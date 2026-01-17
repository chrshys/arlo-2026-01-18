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
      mobile,
      isMobile,
      isHydrated,
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
      mobile,
      isMobile,
      isHydrated,
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
