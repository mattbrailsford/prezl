import { invoke } from '@tauri-apps/api/core'

/** Register the `prezl://` URL scheme to point at the running exe.
 *  Writes HKCU on Windows (per-user, no admin). The registration embeds
 *  the absolute path of the currently-running binary, so re-registering
 *  after moving a portable exe self-heals the link. */
export async function registerProtocol(): Promise<void> {
  await invoke('register_protocol')
}

export async function unregisterProtocol(): Promise<void> {
  await invoke('unregister_protocol')
}

export async function isProtocolRegistered(): Promise<boolean> {
  try {
    return await invoke<boolean>('is_protocol_registered')
  } catch {
    return false
  }
}
