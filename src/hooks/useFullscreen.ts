import { useCallback, useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAppStore } from '@/state/store'

const appWindow = getCurrentWindow()

/**
 * Track and toggle the Tauri window's fullscreen state. F11 bound as the
 * global toggle (suppressed while the video preview modal is active — the
 * video modal owns the full viewport already).
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
      if (e.key !== 'F11') return
      if (useAppStore.getState().previewState.kind === 'video') return
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
