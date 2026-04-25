import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Ctrl+Enter (or Cmd+Enter) triggers the Run action. Capture phase so any
 * focused element (textarea, button) can't claim the key first.
 */
export function useRunShortcut() {
  const runPreview = useAppStore((s) => s.runPreview)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key !== 'Enter') return
      if (useAppStore.getState().previewState.kind !== 'closed') return
      e.preventDefault()
      void runPreview()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [runPreview])
}
