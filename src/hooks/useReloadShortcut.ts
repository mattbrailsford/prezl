import { useEffect } from 'react'

/**
 * Cmd+R / Ctrl+R reloads the WebView. WebView2 (Windows) wires this up
 * natively; WKWebView (macOS) doesn't bind any keyboard shortcuts, so
 * without this hook Cmd+R is silently no-op. Capture phase so focused
 * controls can't claim the key first.
 */
export function useReloadShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.shiftKey || e.altKey) return
      if (e.key !== 'r' && e.key !== 'R') return
      e.preventDefault()
      window.location.reload()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [])
}
