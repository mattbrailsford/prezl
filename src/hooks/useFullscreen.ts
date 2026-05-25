import { useCallback, useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

/**
 * Track and toggle the Tauri window's fullscreen state. JS bindings: F11
 * (Windows/Linux primary; also works on Mac if function keys aren't
 * reclaimed by the OS) and ⌃⌘F (Mac convenience — not a true system
 * shortcut without a menu item, so we wire it here). The system-level
 * Mac shortcut Fn+F goes through native Cocoa instead: the NSWindow has
 * `NSWindowCollectionBehaviorFullScreenPrimary` enabled at startup (see
 * `enable_native_fullscreen` in src-tauri/src/lib.rs), so macOS routes
 * Fn+F to `toggleFullScreen:` without touching JS. The `onResized`
 * listener picks up the resulting state change either way.
 *
 * Both JS bindings stay live while the video demo modal is open: if the
 * presenter accidentally exited fullscreen mid-clip, they need a way
 * back in without closing and replaying the video.
 *
 * Windows quirk: transitioning directly from maximized to fullscreen leaves
 * the taskbar region black (the webview doesn't repaint). We un-maximize
 * first, then enter fullscreen. Exiting fullscreen drops back to windowed
 * (we don't restore the prior maximized state — one less bit of hidden
 * state to reason about).
 */
export function useFullscreen(): {
  isFullscreen: boolean
  toggle: () => Promise<void>
} {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    let cancelled = false
    appWindow.isFullscreen().then((v) => {
      if (!cancelled) setIsFullscreen(v)
    })
    const unlistenPromise = appWindow.onResized(async () => {
      const v = await appWindow.isFullscreen()
      if (!cancelled) setIsFullscreen(v)
    })
    return () => {
      cancelled = true
      unlistenPromise.then((un) => un())
    }
  }, [])

  const toggle = useCallback(async () => {
    const currentlyFullscreen = await appWindow.isFullscreen()
    if (!currentlyFullscreen) {
      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize()
      }
      await appWindow.setFullscreen(true)
      setIsFullscreen(true)
    } else {
      await appWindow.setFullscreen(false)
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isF11 = e.key === 'F11'
      const isMacShortcut =
        e.metaKey &&
        e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key === 'f' || e.key === 'F')
      if (!isF11 && !isMacShortcut) return
      e.preventDefault()
      e.stopPropagation()
      void toggle()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [toggle])

  return { isFullscreen, toggle }
}
