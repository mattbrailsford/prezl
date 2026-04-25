import { invoke } from '@tauri-apps/api/core'

let cached: boolean | null = null

/** Cached portable-mode flag — filename-based check on the running exe.
 *  The result never changes during a session, so cache it on first call. */
export async function isPortableMode(): Promise<boolean> {
  if (cached !== null) return cached
  try {
    cached = await invoke<boolean>('is_portable_mode')
  } catch {
    cached = false
  }
  return cached
}
