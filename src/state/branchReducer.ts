import type { Branch } from '@/types'

export type BranchSwitchInput = {
  branch: Branch
  visibleFiles: string[]
  openTabs: string[]
  activeFile: string | null
}

export type BranchSwitchOutput = {
  openTabs: string[]
  activeFile: string | null
}

/**
 * Pure reducer for the tab reconciliation side of a branch switch.
 * `visibleFiles` is the per-stage result of applying @prezl:file directives
 * to the project's file list; any file not listed is treated as absent on
 * this stage.
 *
 * Invariants:
 *  - Tabs referring to files that are no longer visible are closed.
 *  - The branch's `open.file` (if present and visible) is guaranteed opened
 *    and active.
 *  - If the previously active file is still visible, it stays active unless
 *    the branch explicitly opens a different file.
 *  - If nothing else is open, the first visible file is opened.
 */
export function reconcileBranchSwitch(
  input: BranchSwitchInput,
): BranchSwitchOutput {
  const visible = new Set(input.visibleFiles)
  let openTabs = input.openTabs.filter((p) => visible.has(p))
  let activeFile: string | null = input.activeFile

  if (activeFile && !visible.has(activeFile)) activeFile = null

  const openIntent = input.branch.open?.file
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
