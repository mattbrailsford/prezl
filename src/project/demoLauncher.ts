import { open as openExternal } from '@tauri-apps/plugin-shell'
import type { UrlDemo } from '@/types'

/** Resolve a URL demo's src to an absolute URL and hand it to the OS
 *  default handler via Tauri's shell plugin. Relative file-paths (./...)
 *  are not supported for URL demos — those are for video demos. */
export async function launchUrlDemo(demo: UrlDemo): Promise<void> {
  const src = demo.src.trim()
  if (!/^https?:\/\//i.test(src)) {
    throw new Error(
      `URL demo src must be absolute http(s); got "${src}"`,
    )
  }
  await openExternal(src)
}
