import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Stage navigation — matches common presenter-remote conventions since
 * Monaco is read-only and doesn't need Space/PageDown for itself.
 *
 *   Space        / PageDown / Ctrl+Space        -> next branch
 *   Shift+Space  / PageUp   / Ctrl+Shift+Space  -> previous branch
 *
 * Registered in capture phase so Monaco's internal keybindings can't swallow
 * them when focus is inside the editor. Suppressed when:
 *   - the video modal is open (Space/Esc belong to playback then)
 *   - focus is on a real form control or button (outside Monaco's hidden
 *     input) — keeps Space button activation, select dropdowns, etc. working
 */
export function useBranchShortcuts() {
  const switchBranchRelative = useAppStore((s) => s.switchBranchRelative)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useAppStore.getState().previewState.kind === 'video') return
      if (isInteractiveTarget(e.target)) return

      const direction = directionFromEvent(e)
      if (direction === 0) return
      e.preventDefault()
      e.stopPropagation()
      switchBranchRelative(direction)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [switchBranchRelative])
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

/** Skip the shortcut when a button / real input / select / contentEditable
 *  node owns focus — outside of Monaco's internal hidden input, which we
 *  treat as the stage surface for presentation purposes. */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'BUTTON' || tag === 'SELECT') return true
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    return !isInsideMonacoHost(target)
  }
  return false
}

function isInsideMonacoHost(el: Element): boolean {
  let node: Element | null = el
  while (node) {
    if (node.classList?.contains('monaco-host')) return true
    node = node.parentElement
  }
  return false
}
