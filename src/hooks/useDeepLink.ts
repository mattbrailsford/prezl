import { useEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '@/state/store'
import { useOpenProject } from '@/hooks/useProjectLoader'
import { listRecents } from '@/project/recents'
import { parseDeepLink, type DeepLinkParams } from '@/project/deepLink'

const appWindow = getCurrentWindow()

/**
 * Owns the cold-start boot flow + runtime deep-link handling.
 *
 * Cold start: render BootCurtain (default-true `isRouting`) over the
 * welcome screen until we know whether (a) a `prezl://` URL launched the
 * app, or (b) we should auto-open the most recent project, or (c) neither.
 * Drop the curtain only after that decision settles, so the user never sees
 * the welcome → wrong-recent → correct-project flicker.
 *
 * Runtime: a deep-link click on an already-running Prezl arrives via the
 * `prezl://deep-link` event our Rust setup hook emits. Re-curtain, route,
 * uncurtain. Single-instance plugin handles refocusing the window.
 */
export function useDeepLink() {
  const openProject = useOpenProject()
  const setIsRouting = useAppStore((s) => s.setIsRouting)
  const setLaunchedFromSlide = useAppStore((s) => s.setLaunchedFromSlide)
  const switchScreen = useAppStore((s) => s.switchScreen)
  const bootStarted = useRef(false)

  useEffect(() => {
    if (bootStarted.current) return
    bootStarted.current = true

    const route = async (urlList: string[]): Promise<boolean> => {
      const url = urlList.find(Boolean)
      if (!url) return false
      const params = parseDeepLink(url)
      if (!params) return false
      return applyDeepLink(params, { openProject, switchScreen, setLaunchedFromSlide })
    }

    const settle = () => {
      // Allow one frame so CodeView's layout effects (scroll-into-view,
      // fold seeding) commit before we lift the curtain.
      requestAnimationFrame(() => setIsRouting(false))
    }

    let unlisten: (() => void) | undefined

    ;(async () => {
      try {
        // Cold start: did a `prezl://` URL launch the app?
        const initial = await getInitialUrls()
        if (initial.length > 0) {
          const ok = await route(initial)
          if (ok) return
          // If routing failed (bad path, missing manifest), fall through to
          // recents — user is better off seeing *something* than the
          // load-error overlay over a black screen.
        }

        // No deep link (or it failed): try the most recent project.
        const recents = await listRecents()
        const latest = recents[0]
        if (latest) {
          await openProject(latest.path, { silentFailure: true })
        }
      } finally {
        settle()
      }

      // Runtime: subsequent URLs while already running.
      unlisten = await listen<string[]>('prezl://deep-link', async (event) => {
        setIsRouting(true)
        try {
          await route(event.payload)
        } finally {
          settle()
        }
      })
    })()

    return () => {
      unlisten?.()
    }
  }, [openProject, setIsRouting, setLaunchedFromSlide, switchScreen])
}

/** Cold-start launch URLs from the deep-link plugin. The plugin's JS API
 *  is the canonical source; tolerate any failure (it just means no link). */
async function getInitialUrls(): Promise<string[]> {
  try {
    const { getCurrent } = await import('@tauri-apps/plugin-deep-link')
    const result = await getCurrent()
    return result ?? []
  } catch {
    return []
  }
}

type RouteCtx = {
  openProject: (path: string, opts?: { silentFailure?: boolean }) => Promise<boolean>
  switchScreen: (id: string) => void
  setLaunchedFromSlide: (v: boolean) => void
}

async function applyDeepLink(
  params: DeepLinkParams,
  ctx: RouteCtx,
): Promise<boolean> {
  const ok = await ctx.openProject(params.path)
  if (!ok) return false

  if (params.screen) {
    const index = useAppStore.getState().screenIndex
    if (index && params.screen in index.byId) {
      ctx.switchScreen(params.screen)
    }
  }

  ctx.setLaunchedFromSlide(Boolean(params.hideOnExit))

  if (params.fullscreen) {
    try {
      if (await appWindow.isMaximized()) await appWindow.unmaximize()
      await appWindow.setFullscreen(true)
    } catch {
      /* non-fatal */
    }
  }
  return true
}
