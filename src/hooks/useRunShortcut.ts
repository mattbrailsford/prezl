import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Ctrl+Enter / Cmd+Enter / F5 triggers the Run action. Capture phase so
 * any focused element (textarea, button) can't claim the key first, and
 * so F5's WebView default (page refresh) is suppressed in favour of
 * launching a preview. Ctrl+R still does native refresh.
 *
 * Same dispatch as the Run button: zero previews → status toast, one →
 * launch directly, more than one → open the picker. When the picker is
 * already open the shortcut closes it (toggle) — the picker's own
 * keydown handler also closes on Escape, but mirroring the run keys to
 * a close action keeps the muscle memory consistent.
 */
export function useRunShortcut() {
  const runPreview = useAppStore((s) => s.runPreview)
  const closePreview = useAppStore((s) => s.closePreview)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter'
      const isF5 = e.key === 'F5' && !e.ctrlKey && !e.metaKey && !e.altKey
      if (!isCtrlEnter && !isF5) return
      const kind = useAppStore.getState().previewState.kind
      if (kind === 'launching' || kind === 'video' || kind === 'url') return
      e.preventDefault()
      if (kind === 'picker') {
        closePreview()
        return
      }
      void runPreview()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [runPreview, closePreview])
}
