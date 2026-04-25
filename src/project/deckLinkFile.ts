import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

/** OS-specific shortcut formats used by save_deck_link_file. */
type ShortcutKind = {
  ext: 'url' | 'webloc' | 'desktop'
  filterName: string
}

function detectShortcutKind(): ShortcutKind {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return { ext: 'webloc', filterName: 'Web Location' }
  if (ua.includes('linux')) return { ext: 'desktop', filterName: 'Desktop entry' }
  return { ext: 'url', filterName: 'Internet Shortcut' }
}

/** Prompt for a save location and write a clickable shortcut file pointing
 *  at the given prezl:// URL. The file format follows the host OS, so the
 *  resulting file is double-clickable on the same machine and resolves
 *  through the registered handler. Returns the saved path or null if the
 *  user cancelled. */
export async function saveDeckLinkFile(opts: {
  url: string
  title: string
  defaultName: string
}): Promise<string | null> {
  const kind = detectShortcutKind()
  const target = await save({
    defaultPath: `${opts.defaultName}.${kind.ext}`,
    filters: [{ name: kind.filterName, extensions: [kind.ext] }],
  })
  if (!target) return null
  await invoke('save_deck_link_file', {
    targetPath: target,
    url: opts.url,
    title: opts.title,
  })
  return target
}
