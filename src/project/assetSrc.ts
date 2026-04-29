import { convertFileSrc } from '@tauri-apps/api/core'

// WebView2's HTTP cache keys on URL and survives Ctrl+R, so a replaced-
// on-disk asset (logo, demo video) would keep serving the old bytes after
// a refresh. Tag every asset URL with a session token so a page reload
// (module reinit → new token) bypasses the cache, while repeat opens
// within the same session still hit it.
const SESSION_TOKEN = Date.now().toString(36)

export function convertProjectFileSrc(absolutePath: string): string {
  return `${convertFileSrc(absolutePath)}?_v=${SESSION_TOKEN}`
}
