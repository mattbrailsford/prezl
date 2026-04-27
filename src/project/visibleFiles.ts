import { parseDirectives } from './directiveParser'
import type { ScreenIndex } from './stageList'

/**
 * For each project file, decide whether a `@prezl file=[stages]` directive
 * (if present at the top) gates it out of the current screen. Files with no
 * such directive are always visible. Binary files (paths in `binaryFiles`)
 * are also always visible — we can't parse directives out of them, but they
 * still belong in the explorer with a placeholder.
 */
export function computeVisibleFiles(input: {
  files: string[]
  rawFiles: Map<string, string>
  binaryFiles?: Set<string>
  currentScreenId: string
  screenIndex: ScreenIndex
}): string[] {
  const { files, rawFiles, binaryFiles, currentScreenId, screenIndex } = input
  const visible: string[] = []
  for (const path of files) {
    if (binaryFiles?.has(path)) {
      visible.push(path)
      continue
    }
    const source = rawFiles.get(path)
    if (source == null) continue
    // Fast path: no directive present at all → always visible.
    if (!DIRECTIVE_RE.test(source)) {
      visible.push(path)
      continue
    }
    const rendered = parseDirectives(source, currentScreenId, screenIndex)
    if (!rendered.hiddenForStage) visible.push(path)
  }
  return visible
}

const DIRECTIVE_RE = /@(?:prezl|przl)\b/
