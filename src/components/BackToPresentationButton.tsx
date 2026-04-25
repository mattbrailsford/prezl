import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Presentation } from 'lucide-react'
import { useAppStore } from '@/state/store'

/** Button that hands focus back to whatever launched Prezl (a slide deck).
 *  Only mounted when the project was opened via a deep link with
 *  hideOnExit=1. Platform branching lives on the Rust side: minimize on
 *  Windows / Linux (Z-order returns focus to the slideshow behind);
 *  NSApp.hide() on macOS (jumps back to the previous Space when Keynote
 *  is in fullscreen presenter mode). Shift+Esc binds the same action.
 */
export function BackToPresentationButton() {
  const launched = useAppStore((s) => s.launchedFromSlide)

  useEffect(() => {
    if (!launched) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !e.shiftKey) return
      e.preventDefault()
      e.stopPropagation()
      void invoke('return_to_presentation')
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [launched])

  if (!launched) return null
  return (
    <button
      type="button"
      onClick={() => void invoke('return_to_presentation')}
      title="Back to presentation (Shift+Esc)"
      className="inline-flex items-center justify-center rounded border border-app-border bg-app-panel px-2 py-1 text-app hover:bg-app-border"
      aria-label="Back to presentation"
    >
      <Presentation className="size-5" />
    </button>
  )
}
