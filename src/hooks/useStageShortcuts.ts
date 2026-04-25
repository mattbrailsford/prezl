import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Stage navigation — matches common presenter-remote conventions. The code
 * viewer is static HTML with no captive input, so Space/PageDown stay clean
 * for the presenter regardless of where focus lives.
 *
 *   Space        / PageDown / Ctrl+Space        -> next stage
 *   Shift+Space  / PageUp   / Ctrl+Shift+Space  -> previous stage
 *
 * Registered in capture phase so anything else that wants those keys (modals,
 * dropdowns) doesn't swallow them globally. Suppressed when:
 *   - the video modal is open (Space/Esc belong to playback then)
 *   - focus is on a real interactive control — buttons, selects, or text
 *     inputs — so Space activates buttons / dropdowns / typed input as usual.
 */
export function useStageShortcuts() {
  const switchStageRelative = useAppStore((s) => s.switchStageRelative)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useAppStore.getState().previewState.kind === 'video') return
      if (isInteractiveTarget(e.target)) return

      const direction = directionFromEvent(e)
      if (direction === 0) return
      e.preventDefault()
      e.stopPropagation()
      switchStageRelative(direction)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [switchStageRelative])
}

function directionFromEvent(e: KeyboardEvent): 1 | -1 | 0 {
  const ctrl = e.ctrlKey || e.metaKey

  if (e.code === 'Space') {
    // Ctrl+Space keeps working as a legacy binding; bare Space advances.
    if (ctrl) return e.shiftKey ? -1 : 1
    return e.shiftKey ? -1 : 1
  }
  if (e.code === 'PageDown') return 1
  if (e.code === 'PageUp') return -1
  return 0
}

/** Only suppress when focus is on a *text-typing* surface — text inputs,
 *  textareas, or contentEditable nodes — so the user can still type a
 *  literal space character there. Buttons and selects deliberately fall
 *  through: in a presentation app, Space should advance the stage even if
 *  the user just clicked an explorer item, otherwise the click leaves
 *  Space hijacked and the next press re-opens the file. */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}
