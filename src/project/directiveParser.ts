import { parseStageList, type StageIndex } from './stageList'

export type FoldRange = { start: number; end: number; label: string | null }
export type FocusRange = { start: number; end: number }

export type RenderedFile = {
  /** Source text with all directive comments stripped and `show` regions
   *  that don't match the current stage removed. Line breaks are `\n`. */
  text: string
  foldRanges: FoldRange[]
  focusRanges: FocusRange[]
  /** Name -> 1-based line number in `text`. */
  marks: Record<string, number>
  /** true if a `@prezl:file` directive opts this file out of the current stage. */
  hiddenForStage: boolean
  /** Errors encountered while parsing this file (unknown aliases, unmatched
   *  closes, etc.) — author-facing validation. */
  errors: DirectiveError[]
  /** Rendered line (1-based) -> original source line (1-based). */
  originalLineMap: number[]
}

export type DirectiveError = {
  line: number
  message: string
}

type Directive =
  | { kind: 'file'; stages: string }
  | { kind: 'show' | 'focus'; stages: string }
  | { kind: 'collapse'; stages: string | null; label: string | null }
  | { kind: 'mark'; name: string }
  | { kind: 'close'; name: 'show' | 'collapse' | 'focus' }
  | { kind: 'invalid'; message: string }

/** `// @prezl:...` on its own line, any indent. Trailing text after the
 *  directive args is captured so we can pull out a collapse label. */
const LINE_RE =
  /^\s*(?:\/\/|#|--)\s*@(?:prezl|przl):([A-Za-z/]+)(?:\s+([^\r\n]*))?\s*$/
const BLOCK_RE =
  /^\s*\/\*\s*@(?:prezl|przl):([A-Za-z/]+)(?:\s+([\s\S]*?))?\s*\*\/\s*$/

function detectDirective(rawLine: string): Directive | null {
  const match = LINE_RE.exec(rawLine) ?? BLOCK_RE.exec(rawLine)
  if (!match) return null
  const head = match[1]
  const rest = (match[2] ?? '').trim()

  if (head === 'file') return parseBracketed('file', rest)
  if (head === 'show') return parseBracketed('show', rest)
  if (head === 'focus') return parseBracketed('focus', rest)
  if (head === 'collapse') return parseCollapseArgs(rest)
  if (head === 'mark') {
    if (!/^[A-Za-z_][\w-]*$/.test(rest)) {
      return { kind: 'invalid', message: `invalid mark name: "${rest}"` }
    }
    return { kind: 'mark', name: rest }
  }
  if (head === '/show' || head === '/collapse' || head === '/focus') {
    return { kind: 'close', name: head.slice(1) as 'show' | 'collapse' | 'focus' }
  }
  return { kind: 'invalid', message: `unknown directive: @prezl:${head}` }
}

function parseBracketed(
  kind: 'file' | 'show' | 'focus',
  rest: string,
): Directive {
  const inner = extractBrackets(rest)
  if (inner === null) {
    return { kind: 'invalid', message: `@prezl:${kind} requires [stages]` }
  }
  return { kind, stages: inner.inside }
}

function parseCollapseArgs(rest: string): Directive {
  // Forms:
  //   @prezl:collapse                          -> always fold, no label
  //   @prezl:collapse Label text               -> always fold, labelled
  //   @prezl:collapse [stages]                 -> fold on stages
  //   @prezl:collapse [stages] Label text      -> fold on stages, labelled
  if (rest === '') return { kind: 'collapse', stages: null, label: null }
  if (rest.startsWith('[')) {
    const bracket = extractBrackets(rest)
    if (bracket === null) {
      return { kind: 'invalid', message: 'collapse has unbalanced [' }
    }
    const label = bracket.trailing.trim()
    return {
      kind: 'collapse',
      stages: bracket.inside,
      label: label === '' ? null : label,
    }
  }
  return { kind: 'collapse', stages: null, label: rest }
}

function extractBrackets(
  input: string,
): { inside: string; trailing: string } | null {
  if (!input.startsWith('[')) return null
  const close = input.indexOf(']')
  if (close < 0) return null
  return {
    inside: input.slice(1, close),
    trailing: input.slice(close + 1),
  }
}

type Frame =
  | {
      kind: 'show'
      keeping: boolean
      openLine: number
    }
  | {
      kind: 'collapse'
      contentStart: number // rendered line (1-based) of first content line
      stages: string | null
      label: string | null
      openLine: number
    }
  | {
      kind: 'focus'
      contentStart: number
      stages: string
      openLine: number
    }

export function parseDirectives(
  source: string,
  currentStageAlias: string,
  stageIndex: StageIndex,
): RenderedFile {
  const errors: DirectiveError[] = []
  const foldRanges: FoldRange[] = []
  const focusRanges: FocusRange[] = []
  const marks: Record<string, number> = {}
  const originalLineMap: number[] = []

  const lines = source.split(/\r?\n/)
  const out: string[] = []
  let renderedLine = 0 // last emitted line (1-based)
  const stack: Frame[] = []
  let dropDepth = 0 // how many enclosing `show` regions are dropping content
  let pendingMark: string | null = null
  let hiddenForStage = false
  let sawAnyContent = false

  const evaluate = (stages: string | null): boolean => {
    const result = parseStageList(stages, stageIndex)
    if (!result.ok) return false
    return result.matches(currentStageAlias)
  }
  const validateStageList = (stages: string | null, line: number): void => {
    const result = parseStageList(stages, stageIndex)
    if (!result.ok) errors.push({ line, message: result.error })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const directive = detectDirective(line)
    const isLastLine = i === lines.length - 1
    // Drop empty trailing newline produced by `split`. We'll add one at the end.

    if (directive === null) {
      if (dropDepth === 0) {
        // Skip the trailing empty string from a final newline; keep other blanks.
        if (!(isLastLine && line === '')) {
          out.push(line)
          renderedLine++
          originalLineMap.push(i + 1)
          if (line.trim() !== '') sawAnyContent = true
          if (pendingMark) {
            if (marks[pendingMark] !== undefined) {
              errors.push({
                line: i + 1,
                message: `duplicate mark "${pendingMark}"`,
              })
            } else {
              marks[pendingMark] = renderedLine
            }
            pendingMark = null
          }
        }
      }
      continue
    }

    // Everything below is a directive line — always stripped from output.
    switch (directive.kind) {
      case 'invalid':
        errors.push({ line: i + 1, message: directive.message })
        break

      case 'file': {
        if (sawAnyContent) {
          errors.push({
            line: i + 1,
            message: '@prezl:file must appear before any code',
          })
          break
        }
        validateStageList(directive.stages, i + 1)
        if (!evaluate(directive.stages)) {
          hiddenForStage = true
        }
        break
      }

      case 'mark':
        if (dropDepth === 0) pendingMark = directive.name
        break

      case 'show': {
        validateStageList(directive.stages, i + 1)
        const keeping = dropDepth === 0 && evaluate(directive.stages)
        stack.push({ kind: 'show', keeping, openLine: i + 1 })
        if (!keeping) dropDepth++
        break
      }

      case 'collapse': {
        // Anchor the fold's visible "header" line to the first content line
        // inside the directive pair. Monaco renders `{...}` pairs inline, so
        // `type DashboardConfig = { ... }` reads naturally as the summary.
        const contentStart = renderedLine + 1
        if (dropDepth > 0) {
          stack.push({
            kind: 'collapse',
            contentStart,
            stages: directive.stages,
            label: directive.label,
            openLine: i + 1,
          })
          break
        }
        if (directive.stages !== null) validateStageList(directive.stages, i + 1)
        stack.push({
          kind: 'collapse',
          contentStart,
          stages: directive.stages,
          label: directive.label,
          openLine: i + 1,
        })
        break
      }

      case 'focus': {
        // Focus is a whole-line decoration, not a Monaco fold, so it uses the
        // first *content* line (renderedLine + 1) as its start — we want the
        // highlight to begin with the first visible code line inside the
        // directive pair.
        const contentStart = renderedLine + 1
        if (dropDepth > 0) {
          stack.push({
            kind: 'focus',
            contentStart,
            stages: directive.stages,
            openLine: i + 1,
          })
          break
        }
        validateStageList(directive.stages, i + 1)
        stack.push({
          kind: 'focus',
          contentStart,
          stages: directive.stages,
          openLine: i + 1,
        })
        break
      }

      case 'close': {
        const top = stack.pop()
        if (!top || top.kind !== directive.name) {
          errors.push({
            line: i + 1,
            message: `@prezl:/${directive.name} with no matching open`,
          })
          break
        }
        if (top.kind === 'show') {
          if (!top.keeping) dropDepth = Math.max(0, dropDepth - 1)
          break
        }
        if (dropDepth > 0) break // inner frame was dropped along with an outer
        const end = renderedLine
        if (top.kind === 'collapse') {
          const matches =
            top.stages === null ? true : evaluate(top.stages)
          if (matches && end >= top.contentStart) {
            foldRanges.push({
              start: top.contentStart,
              end,
              label: top.label,
            })
          }
        } else if (top.kind === 'focus') {
          if (evaluate(top.stages) && end >= top.contentStart) {
            focusRanges.push({ start: top.contentStart, end })
          }
        }
        break
      }
    }
  }

  for (const frame of stack) {
    errors.push({
      line: frame.openLine,
      message: `@prezl:${frame.kind} was never closed`,
    })
  }

  return {
    text: out.join('\n'),
    foldRanges,
    focusRanges,
    marks,
    hiddenForStage,
    errors,
    originalLineMap,
  }
}
