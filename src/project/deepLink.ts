/**
 * Deep-link URL: `prezl://open?path=<urlencoded>&screen=<id>&fullscreen=1&hideOnExit=1`
 *
 *   path        absolute folder path of the project (required)
 *   screen      "<stageId>" or "<stageId>.<stepId>" (optional)
 *   fullscreen  "1" to request fullscreen on launch (optional)
 *   hideOnExit  "1" to surface the "Back to presentation" button (optional)
 *
 * `path` is the only mandatory parameter. The rest carry through to the
 * boot routing in useDeepLink + the appStore.launchedFromSlide flag.
 */

export type DeepLinkParams = {
  path: string
  screen?: string
  fullscreen?: boolean
  hideOnExit?: boolean
}

export function buildDeepLink(params: DeepLinkParams): string {
  const search = new URLSearchParams()
  search.set('path', params.path)
  if (params.screen) search.set('screen', params.screen)
  if (params.fullscreen) search.set('fullscreen', '1')
  if (params.hideOnExit) search.set('hideOnExit', '1')
  return `prezl://open?${search.toString()}`
}

export function parseDeepLink(url: string): DeepLinkParams | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'prezl:') return null
  // Be lenient about host vs pathname so `prezl://open?...`,
  // `prezl:open?...`, and `prezl:///open?...` all resolve the same.
  const action = (parsed.host || parsed.pathname.replace(/^\/+/, '')).toLowerCase()
  if (action && action !== 'open') return null
  const path = parsed.searchParams.get('path')
  if (!path) return null
  return {
    path,
    screen: parsed.searchParams.get('screen') ?? undefined,
    fullscreen: parsed.searchParams.get('fullscreen') === '1',
    hideOnExit: parsed.searchParams.get('hideOnExit') === '1',
  }
}
