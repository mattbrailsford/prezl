import { useMemo } from 'react'
import { useAppStore } from '@/state/store'
import { parseDirectives, type RenderedFile } from '@/project/directiveParser'
import { buildStageIndex } from '@/project/stageList'
import { computeVisibleFiles } from '@/project/visibleFiles'
import type { Branch } from '@/types'

export function useStageIndex(): Record<string, number> {
  const branches = useAppStore((s) => s.project?.branches)
  return useMemo(() => {
    if (!branches) return {}
    return buildStageIndex(branches)
  }, [branches])
}

export function useCurrentBranch(): Branch | null {
  return useAppStore((s) => {
    if (!s.project || !s.currentBranchName) return null
    return s.project.branches.find((b) => b.name === s.currentBranchName) ?? null
  })
}

export function useVisibleFiles(): string[] {
  const files = useAppStore((s) => s.project?.files ?? EMPTY_ARRAY)
  const rawFiles = useAppStore((s) => s.rawFiles)
  const branch = useCurrentBranch()
  const stageIndex = useStageIndex()

  return useMemo(() => {
    if (!branch) return []
    return computeVisibleFiles({
      files,
      rawFiles,
      currentStageAlias: branch.alias,
      stageIndex,
    })
  }, [files, rawFiles, branch, stageIndex])
}

/**
 * Render the currently active file for the current stage. Returns null when
 * no project / no active file is loaded.
 */
export function useActiveRenderedFile(): RenderedFile | null {
  const activeFile = useAppStore((s) => s.activeFile)
  const rawFiles = useAppStore((s) => s.rawFiles)
  const branch = useCurrentBranch()
  const stageIndex = useStageIndex()

  return useMemo(() => {
    if (!activeFile || !branch) return null
    const source = rawFiles.get(activeFile)
    if (source == null) return null
    return parseDirectives(source, branch.alias, stageIndex)
  }, [activeFile, rawFiles, branch, stageIndex])
}

const EMPTY_ARRAY: string[] = []
