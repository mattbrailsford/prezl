import { useMemo } from 'react'
import { useAppStore } from '@/state/store'
import { parseDirectives, type RenderedFile } from '@/project/directiveParser'
import { computeVisibleFiles } from '@/project/visibleFiles'
import type { ScreenIndex } from '@/project/stageList'
import type { Screen, Stage } from '@/types'

export type SymbolTarget = { file: string; line: number }
export type SymbolTable = Map<string, SymbolTarget>

const EMPTY_SCREEN_INDEX: ScreenIndex = {
  byId: {},
  ordered: [],
  byStage: {},
}

export function useScreenIndex(): ScreenIndex {
  return useAppStore((s) => s.screenIndex ?? EMPTY_SCREEN_INDEX)
}

export function useCurrentScreen(): Screen | null {
  return useAppStore((s) => {
    if (!s.screenIndex || !s.currentScreenId) return null
    return s.screenIndex.byId[s.currentScreenId] ?? null
  })
}

/** Stage owning the current screen — kept for callers that only need the
 *  stage-level metadata (branch label, title, full step list). */
export function useCurrentStage(): Stage | null {
  return useAppStore((s) => {
    if (!s.project || !s.screenIndex || !s.currentScreenId) return null
    const screen = s.screenIndex.byId[s.currentScreenId]
    if (!screen) return null
    return s.project.stages.find((x) => x.alias === screen.stageAlias) ?? null
  })
}

export function useVisibleFiles(): string[] {
  const files = useAppStore((s) => s.project?.files ?? EMPTY_ARRAY)
  const rawFiles = useAppStore((s) => s.rawFiles)
  const binaryFiles = useAppStore((s) => s.binaryFiles)
  const screen = useCurrentScreen()
  const screenIndex = useScreenIndex()

  return useMemo(() => {
    if (!screen) return []
    return computeVisibleFiles({
      files,
      rawFiles,
      binaryFiles,
      currentScreenId: screen.id,
      screenIndex,
    })
  }, [files, rawFiles, binaryFiles, screen, screenIndex])
}

/**
 * Build a project-wide lookup of marks from the current screen's rendered
 * files. Collisions silently keep the first id encountered (visibleFiles
 * order). Re-parsing every file on every screen change is cheap for the
 * size of project Prezl targets; memoise by inputs to avoid redundant
 * parses on unrelated re-renders.
 */
export function useSymbolTable(): SymbolTable {
  const rawFiles = useAppStore((s) => s.rawFiles)
  const screen = useCurrentScreen()
  const screenIndex = useScreenIndex()
  const files = useVisibleFiles()

  return useMemo(() => {
    const table: SymbolTable = new Map()
    if (!screen) return table
    for (const path of files) {
      const source = rawFiles.get(path)
      if (source == null) continue
      const rendered = parseDirectives(source, screen.id, screenIndex)
      for (const [id, line] of Object.entries(rendered.marks)) {
        if (table.has(id)) continue
        table.set(id, { file: path, line })
      }
    }
    return table
  }, [rawFiles, screen, screenIndex, files])
}

/**
 * Render the currently active file for the current screen. Returns null when
 * no project / no active file is loaded.
 */
export function useActiveRenderedFile(): RenderedFile | null {
  const activeFile = useAppStore((s) => s.activeFile)
  const rawFiles = useAppStore((s) => s.rawFiles)
  const screen = useCurrentScreen()
  const screenIndex = useScreenIndex()

  return useMemo(() => {
    if (!activeFile || !screen) return null
    const source = rawFiles.get(activeFile)
    if (source == null) return null
    const result = parseDirectives(source, screen.id, screenIndex)
    // eslint-disable-next-line no-console
    console.log('[prezl parser]', activeFile, 'on', screen.id, {
      foldRanges: result.foldRanges,
      focusRanges: result.focusRanges,
      marks: result.marks,
      hiddenForStage: result.hiddenForStage,
      errors: result.errors,
      renderedLineCount: result.text.split('\n').length,
    })
    return result
  }, [activeFile, rawFiles, screen, screenIndex])
}

const EMPTY_ARRAY: string[] = []
