import { parseDirectives } from './directiveParser'
import type { ScreenIndex } from './stageList'

/**
 * For each project file, decide whether a `@prezl file=[stages]` directive
 * (if present at the top) gates it out of the current screen. Files with no
 * such directive are always visible.
 */
export function computeVisibleFiles(input: {
  files: string[]
  rawFiles: Map<string, string>
  currentScreenId: string
  screenIndex: ScreenIndex
}): string[] {
  const { files, rawFiles, currentScreenId, screenIndex } = input
  const visible: string[] = []
  for (const path of files) {
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
