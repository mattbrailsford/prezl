import { open as openExternal } from '@tauri-apps/plugin-shell'
import type { UrlPreview } from '@/types'

/** Resolve a URL preview's src to an absolute URL and hand it to the OS
 *  default handler via Tauri's shell plugin. Relative file-paths (./...)
 *  are not supported for URL previews — those are for video previews. */
export async function launchUrlPreview(preview: UrlPreview): Promise<void> {
  const src = preview.src.trim()
  if (!/^https?:\/\//i.test(src)) {
    throw new Error(
      `URL preview src must be absolute http(s); got "${src}"`,
    )
  }
  await openExternal(src)
}
