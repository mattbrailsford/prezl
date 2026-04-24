import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Ctrl+Enter (or Cmd+Enter) triggers the Run action. Registered in capture
 * phase so Monaco's own Enter handling doesn't swallow it when focus is in
 * the editor.
 */
export function useRunShortcut() {
  const runPreview = useAppStore((s) => s.runPreview)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key !== 'Enter') return
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
