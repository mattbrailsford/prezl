import { useEffect, useRef } from 'react'
import { useAppStore } from '@/state/store'

const MIN = 0.6
const MAX = 2.5
const STEP = 0.1
const BASE_HTML_FONT_PX = 14

export function clampScale(value: number): number {
  return Math.max(MIN, Math.min(MAX, Math.round(value * 100) / 100))
}

/**
 * Drives presentation-mode zoom across UI (Tailwind rem-based) and the
 * code viewer's font size. Ctrl+=/Ctrl+-/Ctrl+Up/Ctrl+Down/Ctrl+0, plus
 * Ctrl+MouseWheel.
 */
export function useUiScale() {
  const uiScale = useAppStore((s) => s.preferences.uiScale)
  const setPreferences = useAppStore((s) => s.setPreferences)
  const setStatusMessage = useAppStore((s) => s.setStatusMessage)

  const hideStatusTimer = useRef<number | null>(null)

  // Apply to html font-size whenever uiScale changes.
  useEffect(() => {
    document.documentElement.style.fontSize = `${BASE_HTML_FONT_PX * uiScale}px`
  }, [uiScale])

  // Flash zoom status in the status bar.
  const flashZoomStatus = (nextScale: number) => {
    const pct = Math.round(nextScale * 100)
    setStatusMessage(`Zoom: ${pct}%`)
    if (hideStatusTimer.current) window.clearTimeout(hideStatusTimer.current)
    hideStatusTimer.current = window.setTimeout(() => {
      setStatusMessage('Ready')
      hideStatusTimer.current = null
    }, 1200)
  }

  // Shortcuts + wheel zoom.
  useEffect(() => {
    const adjust = (delta: number) => {
      const current = useAppStore.getState().preferences.uiScale
      const next = clampScale(current + delta)
      if (next !== current) {
        setPreferences({ uiScale: next })
        flashZoomStatus(next)
      }
    }
    const reset = () => {
      const current = useAppStore.getState().preferences.uiScale
      if (current !== 1) {
        setPreferences({ uiScale: 1 })
        flashZoomStatus(1)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      switch (e.key) {
        case '=':
        case '+':
        case 'ArrowUp':
          e.preventDefault()
          adjust(STEP)
          break
        case '-':
        case '_':
        case 'ArrowDown':
          e.preventDefault()
          adjust(-STEP)
          break
        case '0':
          e.preventDefault()
          reset()
          break
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      adjust(e.deltaY < 0 ? STEP : -STEP)
    }

    // Capture phase so any browser/native zoom or wheel handler can't claim
    // these first when the cursor is over the code viewer.
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions)
      window.removeEventListener('wheel', onWheel, { capture: true } as EventListenerOptions)
    }
  }, [setPreferences, setStatusMessage])
}

export function editorFontSize(uiScale: number): number {
  return Math.round(14 * uiScale)
}
