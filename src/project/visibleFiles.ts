import { parseDirectives } from './directiveParser'
import type { ScreenIndex } from './stageList'

export type FileVisibility = {
  /** Project files visible in the explorer on the current screen, in input order. */
  visible: string[]
  /** Subset of `visible` whose file= directive carries a sibling `focus=`
   *  selector that resolves on the current screen. The explorer reads this
   *  to highlight the leaf entry (and its ancestor folders, quietly). */
  focused: Set<string>
}

/**
 * For each project file, decide whether a `@prezl file=[stages]` directive
 * (if present at the top) gates it out of the current screen, and whether
 * a sibling `focus=` selector marks it for explorer highlighting. Files
 * with no directive are always visible (and never focused). Binary files
 * (paths in `binaryFiles`) are also always visible — we can't parse
 * directives out of them, but they still belong in the explorer with a
 * placeholder.
 */
export function computeFileVisibility(input: {
  files: string[]
  rawFiles: Map<string, string>
  binaryFiles?: Set<string>
  currentScreenId: string
  screenIndex: ScreenIndex
}): FileVisibility {
  const { files, rawFiles, binaryFiles, currentScreenId, screenIndex } = input
  const visible: string[] = []
  const focused = new Set<string>()
  for (const path of files) {
    if (binaryFiles?.has(path)) {
      visible.push(path)
      continue
    }
    const source = rawFiles.get(path)
    if (source == null) continue
    // Fast path: no directive present at all → always visible, never focused.
    if (!DIRECTIVE_RE.test(source)) {
      visible.push(path)
      continue
    }
    const rendered = parseDirectives(source, currentScreenId, screenIndex)
    if (!rendered.hiddenForStage) {
      visible.push(path)
      if (rendered.focusedForScreen) focused.add(path)
    }
  }
  return { visible, focused }
}

/** Backwards-compatible thin wrapper for callers that only need the visible
 *  list (symbol tables, file-watching). New consumers that also want the
 *  focused set should use {@link computeFileVisibility} directly. */
export function computeVisibleFiles(input: {
  files: string[]
  rawFiles: Map<string, string>
  binaryFiles?: Set<string>
  currentScreenId: string
  screenIndex: ScreenIndex
}): string[] {
  return computeFileVisibility(input).visible
}

const DIRECTIVE_RE = /@(?:prezl|przl)\b/
