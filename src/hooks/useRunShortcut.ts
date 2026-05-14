import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Ctrl+Enter / Cmd+Enter / F5 / Ctrl+F5 triggers the Run action. Capture
 * phase so any focused element (textarea, button) can't claim the key
 * first, and so the WebView's F5 / Ctrl+F5 page-refresh defaults are
 * suppressed in favour of launching a demo. Cmd+R / Ctrl+R reload is
 * handled separately by useReloadShortcut.
 *
 * Same dispatch as the Run button: zero demos → status toast, one →
 * launch directly, more than one → open the picker. When the picker is
 * already open the shortcut closes it (toggle) — the picker's own
 * keydown handler also closes on Escape, but mirroring the run keys to
 * a close action keeps the muscle memory consistent.
 */
export function useRunShortcut() {
  const runDemo = useAppStore((s) => s.runDemo)
  const closeDemo = useAppStore((s) => s.closeDemo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter'
      const isF5 = e.key === 'F5' && !e.altKey && !e.shiftKey
      if (!isCtrlEnter && !isF5) return
      const kind = useAppStore.getState().demoState.kind
      if (kind === 'launching' || kind === 'video' || kind === 'url') return
      e.preventDefault()
      if (kind === 'picker') {
        closeDemo()
        return
      }
      void runDemo()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [runDemo, closeDemo])
}
