import { useEffect, useRef } from 'react'
import { useAppStore } from '@/state/store'

export function useExplorerToggle() {
  const setPreferences = useAppStore((s) => s.setPreferences)
  const setStatusMessage = useAppStore((s) => s.setStatusMessage)
  const hintTimer = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return
      if (e.key.toLowerCase() !== 'e') return
      if (useAppStore.getState().demoState.kind === 'video') return
      e.preventDefault()

      const state = useAppStore.getState()
      const next = !state.preferences.explorerCollapsed
      setPreferences({ explorerCollapsed: next })

      if (next && !state.preferences.explorerHintShown) {
        setPreferences({ explorerHintShown: true })
        setStatusMessage('Ctrl+E to show explorer')
        if (hintTimer.current) window.clearTimeout(hintTimer.current)
        hintTimer.current = window.setTimeout(() => {
          setStatusMessage('Ready')
          hintTimer.current = null
        }, 2000)
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions)
  }, [setPreferences, setStatusMessage])
}
