import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Ctrl+Space           -> next branch
 * Ctrl+Shift+Space     -> previous branch
 *
 * Registered in capture phase so Monaco's internal keybindings can't swallow
 * them when focus is inside the editor.
 */
export function useBranchShortcuts() {
  const switchBranchRelative = useAppStore((s) => s.switchBranchRelative)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.code !== 'Space') return
      e.preventDefault()
      switchBranchRelative(e.shiftKey ? -1 : 1)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [switchBranchRelative])
}
