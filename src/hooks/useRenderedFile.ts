import { useMemo } from 'react'
import { useAppStore } from '@/state/store'
import { parseDirectives, type RenderedFile } from '@/project/directiveParser'
import { buildStageIndex } from '@/project/stageList'
import { computeVisibleFiles } from '@/project/visibleFiles'
import type { Branch } from '@/types'

export type SymbolTarget = { file: string; line: number }
export type SymbolTable = Map<string, SymbolTarget>

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
 * Build a project-wide lookup of marks from the current stage's rendered
 * files. Collisions silently keep the first id encountered (visibleFiles
 * order). Re-parsing every file on every stage change is cheap for the
 * size of project Prezl targets; memoise by inputs to avoid redundant
 * parses on unrelated re-renders.
 */
export function useSymbolTable(): SymbolTable {
  const rawFiles = useAppStore((s) => s.rawFiles)
  const branch = useCurrentBranch()
  const stageIndex = useStageIndex()
  const files = useVisibleFiles()

  return useMemo(() => {
    const table: SymbolTable = new Map()
    if (!branch) return table
    for (const path of files) {
      const source = rawFiles.get(path)
      if (source == null) continue
      const rendered = parseDirectives(source, branch.alias, stageIndex)
      for (const [id, line] of Object.entries(rendered.marks)) {
        if (table.has(id)) continue
        table.set(id, { file: path, line })
      }
    }
    return table
  }, [rawFiles, branch, stageIndex, files])
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
    const result = parseDirectives(source, branch.alias, stageIndex)
    // eslint-disable-next-line no-console
    console.log('[prezl parser]', activeFile, 'on', branch.alias, {
      foldRanges: result.foldRanges,
      focusRanges: result.focusRanges,
      marks: result.marks,
      hiddenForStage: result.hiddenForStage,
      errors: result.errors,
      renderedLineCount: result.text.split('\n').length,
    })
    return result
  }, [activeFile, rawFiles, branch, stageIndex])
}

const EMPTY_ARRAY: string[] = []
