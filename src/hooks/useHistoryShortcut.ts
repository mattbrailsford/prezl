import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Keyboard back/forward over the location-history stack. Cmd+[/] is the
 * Mac convention (Safari, Finder); Alt+Left/Right is the Windows/Chrome
 * convention. Both pairs are bound so muscle memory works across
 * platforms regardless of where the presenter usually develops.
 *
 * Capture phase to beat focused controls. Suppressed during the video
 * demo modal — same rule the mouse-button binding follows. Suppressed
 * when focus is on a text-typing surface so Cmd+[ doesn't hijack
 * indentation in (hypothetical) future editable inputs.
 */
export function useHistoryShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const direction = directionFor(e)
      if (direction === null) return
      if (isTypingTarget(e.target)) return
      const store = useAppStore.getState()
      if (store.demoState.kind === 'video') return
      e.preventDefault()
      if (direction === 'back') store.goBack()
      else store.goForward()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [])
}

function directionFor(e: KeyboardEvent): 'back' | 'forward' | null {
  if (e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    if (e.key === '[') return 'back'
    if (e.key === ']') return 'forward'
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    if (e.key === 'ArrowLeft') return 'back'
    if (e.key === 'ArrowRight') return 'forward'
  }
  return null
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}
