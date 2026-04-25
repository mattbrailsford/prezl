import type { Stage } from '@/types'

export type StageSwitchInput = {
  stage: Stage
  visibleFiles: string[]
  openTabs: string[]
  activeFile: string | null
}

export type StageSwitchOutput = {
  openTabs: string[]
  activeFile: string | null
}

/**
 * Pure reducer for the tab reconciliation side of a stage switch.
 * `visibleFiles` is the per-stage result of applying @prezl:file directives
 * to the project's file list; any file not listed is treated as absent on
 * this stage.
 *
 * Invariants:
 *  - Tabs referring to files that are no longer visible are closed.
 *  - The stage's `open.file` (if present and visible) is guaranteed opened
 *    and active.
 *  - If the previously active file is still visible, it stays active unless
 *    the stage explicitly opens a different file.
 *  - If nothing else is open, the first visible file is opened.
 */
export function reconcileStageSwitch(
  input: StageSwitchInput,
): StageSwitchOutput {
  const visible = new Set(input.visibleFiles)
  let openTabs = input.openTabs.filter((p) => visible.has(p))
  let activeFile: string | null = input.activeFile

  if (activeFile && !visible.has(activeFile)) activeFile = null

  const openIntent = input.stage.open?.file
  if (openIntent && visible.has(openIntent)) {
    if (!openTabs.includes(openIntent)) openTabs = [...openTabs, openIntent]
    activeFile = openIntent
  }

  if (openTabs.length === 0 && input.visibleFiles.length > 0) {
    const first = input.visibleFiles[0]!
    openTabs = [first]
    activeFile = first
  }

  if (!activeFile && openTabs.length > 0) {
    activeFile = openTabs[openTabs.length - 1]!
  }

  return { openTabs, activeFile }
}
