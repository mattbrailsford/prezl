import { invoke } from '@tauri-apps/api/core'

export type RecentEntry = {
  path: string
  name: string | null
  lastOpenedMs: number
}

type BackendRecent = {
  path: string
  name: string | null
  last_opened_ms: number
}

function toFrontend(e: BackendRecent): RecentEntry {
  return { path: e.path, name: e.name, lastOpenedMs: e.last_opened_ms }
}

export async function listRecents(): Promise<RecentEntry[]> {
  const raw = await invoke<BackendRecent[]>('list_recents')
  return raw.map(toFrontend)
}

export async function rememberRecent(path: string, name: string | null): Promise<RecentEntry[]> {
  const raw = await invoke<BackendRecent[]>('remember_recent', {
    path,
    name,
    lastOpenedMs: Date.now(),
  })
  return raw.map(toFrontend)
}

export async function forgetRecent(path: string): Promise<RecentEntry[]> {
  const raw = await invoke<BackendRecent[]>('forget_recent', { path })
  return raw.map(toFrontend)
}
