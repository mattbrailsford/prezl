import { useMemo } from 'react'
import { useAppStore } from '@/state/store'
import { parseDirectives, type RenderedFile } from '@/project/directiveParser'
import {
  computeFileVisibility,
  type FileVisibility,
} from '@/project/visibleFiles'
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
    return s.project.stages.find((x) => x.id === screen.stageId) ?? null
  })
}

/** Visible explorer paths plus the subset that carries an active file-level
 *  focus on the current screen. `useVisibleFiles` is a thin slice on top for
 *  consumers (symbol tables, etc.) that only need the array. */
export function useFileVisibility(): FileVisibility {
  const files = useAppStore((s) => s.project?.files ?? EMPTY_ARRAY)
  const rawFiles = useAppStore((s) => s.rawFiles)
  const binaryFiles = useAppStore((s) => s.binaryFiles)
  const screen = useCurrentScreen()
  const screenIndex = useScreenIndex()

  return useMemo(() => {
    if (!screen) return EMPTY_VISIBILITY
    return computeFileVisibility({
      files,
      rawFiles,
      binaryFiles,
      currentScreenId: screen.id,
      screenIndex,
    })
  }, [files, rawFiles, binaryFiles, screen, screenIndex])
}

export function useVisibleFiles(): string[] {
  return useFileVisibility().visible
}

const EMPTY_VISIBILITY: FileVisibility = { visible: [], focused: new Set() }

/**
 * Build a project-wide lookup of marks from the current screen's rendered
 * files. Collisions silently keep the first id encountered (visibleFiles
 * order). Re-parsing every file on every screen change is cheap for the
 * size of project Prezl targets; memoise by inputs to avoid redundant
 * parses on unrelated re-renders.
 *
 * Returns *all* anchors, including pure section markers with no usages.
 * The picker uses {@link useNavigableSymbols} to surface only the ids
 * that actually appear as clickable text somewhere; the unfiltered table
 * stays useful for click-to-jump (where non-referenced ids are no-ops
 * because there's nothing to wrap) and as the canonical anchor map.
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
 * Filtered view of {@link useSymbolTable} that drops anchors with no
 * usages — i.e. ids that never appear as a word-boundary token in any
 * visible file's rendered text outside their own definition line. These
 * are pure section markers (typically used as `open.id` scroll targets);
 * surfacing them in the Ctrl+T picker is noise because there's nowhere
 * to "jump from" — the rendered code never carries the name.
 */
export function useNavigableSymbols(): SymbolTable {
  const rawFiles = useAppStore((s) => s.rawFiles)
  const screen = useCurrentScreen()
  const screenIndex = useScreenIndex()
  const files = useVisibleFiles()
  const symbolTable = useSymbolTable()

  return useMemo(() => {
    if (!screen || symbolTable.size === 0) return EMPTY_SYMBOL_TABLE
    const referenced = new Set<string>()
    const wordRe = /\b[A-Za-z_]\w*\b/g
    for (const path of files) {
      const source = rawFiles.get(path)
      if (source == null) continue
      const rendered = parseDirectives(source, screen.id, screenIndex)
      const lines = rendered.text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const lineNumber = i + 1
        wordRe.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = wordRe.exec(lines[i])) !== null) {
          const id = m[0]
          if (referenced.has(id)) continue
          const def = symbolTable.get(id)
          if (!def) continue
          if (def.file === path && def.line === lineNumber) continue
          referenced.add(id)
        }
      }
      if (referenced.size === symbolTable.size) break
    }
    if (referenced.size === symbolTable.size) return symbolTable
    const filtered: SymbolTable = new Map()
    for (const [id, target] of symbolTable) {
      if (referenced.has(id)) filtered.set(id, target)
    }
    return filtered
  }, [rawFiles, screen, screenIndex, files, symbolTable])
}

const EMPTY_SYMBOL_TABLE: SymbolTable = new Map()

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
