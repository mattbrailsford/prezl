import type { Screen } from '@/types'

export type ScreenSwitchInput = {
  screen: Screen
  visibleFiles: string[]
  openTabs: string[]
  activeFile: string | null
}

export type ScreenSwitchOutput = {
  openTabs: string[]
  activeFile: string | null
}

/**
 * Pure reducer for the tab reconciliation side of a screen switch.
 * `visibleFiles` is the per-screen result of applying `@prezl file=` directives
 * to the project's file list; any file not listed is treated as absent on
 * this screen.
 *
 * Invariants:
 *  - Tabs referring to files that are no longer visible are closed.
 *  - The screen's `open.file` (if present and visible) is guaranteed opened
 *    and active. Step-level open overrides reach this via the resolved
 *    `screen.open` from the screen index.
 *  - If `screen.open` is explicitly `null` (the author wrote `open: ~`),
 *    every tab is closed and there is no active file — an "intro" empty
 *    state where only the file tree is visible.
 *  - If the previously active file is still visible, it stays active unless
 *    the screen explicitly opens a different file. This is how undefined
 *    `open` inherits the prior screen's state (sticky-forward across
 *    stages and steps).
 *  - No file auto-opens. With nothing prior and no `open:` declared, the
 *    pane stays empty until the presenter clicks a file or a later screen
 *    sets `open:`. The presenter starts with a clean file tree by default.
 */
export function reconcileScreenSwitch(
  input: ScreenSwitchInput,
): ScreenSwitchOutput {
  // Explicit "no file" intent — author wrote `open: ~`. Skip every fallback
  // so the editor pane stays empty.
  if (input.screen.open === null) {
    return { openTabs: [], activeFile: null }
  }

  const visible = new Set(input.visibleFiles)
  let openTabs = input.openTabs.filter((p) => visible.has(p))
  let activeFile: string | null = input.activeFile

  if (activeFile && !visible.has(activeFile)) activeFile = null

  const openIntent = input.screen.open?.file
  if (openIntent && visible.has(openIntent)) {
    if (!openTabs.includes(openIntent)) openTabs = [...openTabs, openIntent]
    activeFile = openIntent
  }

  if (!activeFile && openTabs.length > 0) {
    activeFile = openTabs[openTabs.length - 1]!
  }

  return { openTabs, activeFile }
}

/**
 * Collapse the reconciled output to just the resolved active file — the tab
 * side of the stage-level `reset:` flag. Caller decides when to apply it
 * (cross-stage forward entry into a stage that opted in); the explorer-side
 * collapse is signalled separately via the store's explorerResetToken.
 */
export function applyStageEntryReset(
  output: ScreenSwitchOutput,
): ScreenSwitchOutput {
  return {
    openTabs: output.activeFile ? [output.activeFile] : [],
    activeFile: output.activeFile,
  }
}
