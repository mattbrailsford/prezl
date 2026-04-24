import { invoke } from '@tauri-apps/api/core'
import type { Preferences } from '@/types'

/** Read persisted preferences from appConfigDir/preferences.json. Returns
 *  null when the file doesn't exist yet (fresh install). */
export async function readPreferences(): Promise<Partial<Preferences> | null> {
  const raw = await invoke<Partial<Preferences> | null>('read_preferences')
  return raw ?? null
}

/** Persist the current preferences to appConfigDir/preferences.json. */
export async function writePreferences(preferences: Preferences): Promise<void> {
  await invoke('write_preferences', { preferences })
}
