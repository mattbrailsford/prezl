import type { Branch } from '@/types'

export type BranchSwitchInput = {
  branch: Branch
  openTabs: string[]
  activeFile: string | null
}

export type BranchSwitchOutput = {
  openTabs: string[]
  activeFile: string | null
}

/**
 * Pure reducer for the tab reconciliation side of a branch switch.
 * Invariants:
 *  - Tabs referring to files that no longer exist in the new branch are closed.
 *  - The branch's `open.file` (if present) is guaranteed to be open and active.
 *  - If the previously active file is still visible, it stays active unless
 *    the branch explicitly opens a different file.
 *  - If nothing else is open, the first file in the branch is opened.
 */
export function reconcileBranchSwitch(
  input: BranchSwitchInput,
): BranchSwitchOutput {
  const visible = new Set(input.branch.files.map((f) => f.path))
  let openTabs = input.openTabs.filter((p) => visible.has(p))
  let activeFile: string | null = input.activeFile

  if (activeFile && !visible.has(activeFile)) activeFile = null

  const openIntent = input.branch.open?.file
  if (openIntent && visible.has(openIntent)) {
    if (!openTabs.includes(openIntent)) openTabs = [...openTabs, openIntent]
    activeFile = openIntent
  }

  if (openTabs.length === 0) {
    const first = input.branch.files[0]?.path
    if (first) {
      openTabs = [first]
      activeFile = first
    }
  }

  if (!activeFile && openTabs.length > 0) {
    activeFile = openTabs[openTabs.length - 1]!
  }

  return { openTabs, activeFile }
}
