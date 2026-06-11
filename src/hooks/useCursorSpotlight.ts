import { useEffect, useRef } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Toggles the cursor spotlight halo (Ctrl/Cmd+Shift+H) and flashes the new
 * state in the status bar — same transient-status pattern as `useUiScale`'s
 * zoom readout. The preference is persisted, so the choice survives restarts.
 *
 * Capture phase so a focused control can't claim the chord first, matching
 * the other global Prezl shortcuts.
 */
export function useCursorSpotlight() {
  const setPreferences = useAppStore((s) => s.setPreferences)
  const setStatusMessage = useAppStore((s) => s.setStatusMessage)
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    const flash = (msg: string) => {
      setStatusMessage(msg)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => {
        setStatusMessage('Ready')
        hideTimer.current = null
      }, 1200)
    }

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return
      if (e.code !== 'KeyH') return
      e.preventDefault()
      e.stopPropagation()
      const next = !useAppStore.getState().preferences.cursorSpotlight
      setPreferences({ cursorSpotlight: next })
      flash(next ? 'Cursor highlight: on' : 'Cursor highlight: off')
    }

    window.addEventListener('keydown', onKey, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [setPreferences, setStatusMessage])
}
