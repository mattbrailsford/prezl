import { parseDirectives } from './directiveParser'
import type { StageIndex } from './stageList'

/**
 * For each project file, decide whether a `@prezl:file [stages]` directive
 * (if present at the top) gates it out of the current stage. Files with no
 * such directive are always visible.
 */
export function computeVisibleFiles(input: {
  files: string[]
  rawFiles: Map<string, string>
  currentStageAlias: string
  stageIndex: StageIndex
}): string[] {
  const { files, rawFiles, currentStageAlias, stageIndex } = input
  const visible: string[] = []
  for (const path of files) {
    const source = rawFiles.get(path)
    if (source == null) continue
    // Fast path: no directive present at all → always visible.
    if (!DIRECTIVE_RE.test(source)) {
      visible.push(path)
      continue
    }
    const rendered = parseDirectives(source, currentStageAlias, stageIndex)
    if (!rendered.hiddenForStage) visible.push(path)
  }
  return visible
}

const DIRECTIVE_RE = /@(?:prezl|przl):/
