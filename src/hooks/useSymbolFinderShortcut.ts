import { useEffect } from 'react'
import { useAppStore } from '@/state/store'

/**
 * Ctrl+T / Cmd+T opens the fuzzy symbol finder (IntelliJ/Rider convention).
 * WebView2's native "new tab" accelerator is disabled via the Rust setup
 * hook (see `disable_browser_accelerators` in src-tauri/src/lib.rs), so
 * the keystroke reaches our JS listener. Monaco's built-in Ctrl+T binding
 * is also disabled in CodeEditor.onMount so its symbol-picker widget
 * doesn't compete.
 *
 * Capture phase + preventDefault. Suppressed while the video preview is
 * active, or if the finder is already open.
 */
export function useSymbolFinderShortcut() {
  const openSymbolFinder = useAppStore((s) => s.openSymbolFinder)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== 't') return
      if (useAppStore.getState().previewState.kind === 'video') return
      if (useAppStore.getState().symbolFinderOpen) return
      e.preventDefault()
      e.stopPropagation()
      openSymbolFinder()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [openSymbolFinder])
}
