import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Mouse XButton1 (back) / XButton2 (forward) drive the location-history
 * stack — same model browsers use, but for our explorer-and-screen
 * navigation. Wires goBack / goForward in the store.
 *
 * `MouseEvent.button` values for the side buttons are 3 and 4 respectively.
 * We listen on mousedown in capture phase to preventDefault before any
 * embedded webview tries to interpret them as actual browser navigation,
 * and on mouseup to fire the action — matching browser convention so a
 * stray drag-then-release doesn't navigate.
 *
 * Suppressed when the video demo modal is open; the modal owns its own
 * dismissal/playback semantics and presenters expect mouse buttons to do
 * nothing surprising while it's up.
 */
const MOUSE_BACK = 3
const MOUSE_FORWARD = 4

export function useMouseHistoryNav() {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== MOUSE_BACK && e.button !== MOUSE_FORWARD) return
      e.preventDefault()
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== MOUSE_BACK && e.button !== MOUSE_FORWARD) return
      e.preventDefault()
      e.stopPropagation()
      const store = useAppStore.getState()
      if (store.demoState.kind === 'video') return
      if (e.button === MOUSE_BACK) store.goBack()
      else store.goForward()
    }
    window.addEventListener('mousedown', onMouseDown, { capture: true })
    window.addEventListener('mouseup', onMouseUp, { capture: true })
    return () => {
      window.removeEventListener('mousedown', onMouseDown, {
        capture: true,
      } as EventListenerOptions)
      window.removeEventListener('mouseup', onMouseUp, {
        capture: true,
      } as EventListenerOptions)
    }
  }, [])
}
