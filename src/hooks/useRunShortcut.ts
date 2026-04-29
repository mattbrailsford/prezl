import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Ctrl+Enter (or Cmd+Enter) triggers the Run action. Capture phase so any
 * focused element (textarea, button) can't claim the key first.
 *
 * Same dispatch as the Run button: zero previews → status toast, one →
 * launch directly, more than one → open the picker. When the picker is
 * already open the shortcut closes it (toggle) — the picker's own
 * keydown handler also closes on Escape, but Ctrl+Enter mirroring the
 * button feels right.
 */
export function useRunShortcut() {
  const runPreview = useAppStore((s) => s.runPreview)
  const closePreview = useAppStore((s) => s.closePreview)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key !== 'Enter') return
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
