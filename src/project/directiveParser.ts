import { parseScreenList, type ScreenIndex } from './stageList'

export type FoldRange = {
  start: number
  end: number
  label: string | null
  /** Leading whitespace of the opening `@prezl` directive line. The viewer
   *  uses this to render the comment placeholder for labeled collapsed folds
   *  at the same depth as the directive that introduced them. */
  indent: string
}
export type FocusRange = { start: number; end: number }

export type RenderedFile = {
  /** Source text with all directive comments stripped and `show` regions
   *  that don't match the current stage removed. Line breaks are `\n`. */
  text: string
  foldRanges: FoldRange[]
  focusRanges: FocusRange[]
  /** Name -> 1-based line number in `text`. */
  marks: Record<string, number>
  /** true if a `file=[stages]` directive opts this file out of the current stage. */
  hiddenForStage: boolean
  /** true if a sibling `focus(=[stages])?` on the file= directive resolves
   *  for the current screen. Always false when `hiddenForStage` is true —
   *  focus implies visible. The explorer reads this to highlight the file's
   *  tree entry (and its ancestor folders, quietly) on matching screens. */
  focusedForScreen: boolean
  /** Errors encountered while parsing this file. */
  errors: DirectiveError[]
  /** Rendered line (1-based) -> original source line (1-based). */
  originalLineMap: number[]
}

export type DirectiveError = {
  line: number
  message: string
}

type Attributes = {
  id?: string
  show?: string
  focus?: string | true
  collapse?: string | true
  label?: string
  file?: string
  end?: string | true
}

type Directive =
  | { kind: 'end'; id: string | null }
  | { kind: 'file'; stages: string; focus: string | true | null }
  | { kind: 'anchor'; id: string }
  | {
      kind: 'region'
      id: string | null
      show: string | null
      focus: string | true | null
      collapse: string | true | null
      label: string | null
    }
  | { kind: 'invalid'; message: string }

/** `// @prezl ...` on its own line (any leading indent). Also matches `# ...`,
 *  `-- ...`, and the single-line block forms `/* ... *\/`, `<!-- ... -->`,
 *  and Razor's `@* ... *@`. */
const LINE_RE =
  /^\s*(?:\/\/|#|--)\s*@(?:prezl|przl)\b\s*([^\r\n]*?)\s*$/
const BLOCK_RE =
  /^\s*\/\*\s*@(?:prezl|przl)\b\s*([\s\S]*?)\s*\*\/\s*$/
const HTML_RE =
  /^\s*<!--\s*@(?:prezl|przl)\b\s*([\s\S]*?)\s*-->\s*$/
const RAZOR_RE =
  /^\s*@\*\s*@(?:prezl|przl)\b\s*([\s\S]*?)\s*\*@\s*$/

function detectDirective(rawLine: string): Directive | null {
  const match =
    LINE_RE.exec(rawLine) ??
    BLOCK_RE.exec(rawLine) ??
    HTML_RE.exec(rawLine) ??
    RAZOR_RE.exec(rawLine)
  if (!match) return null
  const body = match[1] ?? ''

  const tokens = tokenizeAttributes(body)
  if ('error' in tokens) return { kind: 'invalid', message: tokens.error }

  return classify(tokens.attrs)
}

function tokenizeAttributes(
  body: string,
): { attrs: Attributes } | { error: string } {
  const attrs: Attributes = {}
  let i = 0
  const len = body.length

  while (i < len) {
    while (i < len && /\s/.test(body[i])) i++
    if (i >= len) break

    // Read key
    const keyStart = i
    while (i < len && /[A-Za-z_]/.test(body[i])) i++
    const key = body.slice(keyStart, i)
    if (key === '') {
      return { error: `unexpected character "${body[i]}" at position ${i}` }
    }

    // Optional `=value`
    if (i < len && body[i] === '=') {
      i++
      if (i >= len) return { error: `missing value for attribute "${key}"` }
      if (body[i] === '[') {
        const close = body.indexOf(']', i + 1)
        if (close < 0) return { error: `unclosed [ in attribute "${key}"` }
        const value = body.slice(i + 1, close)
        ;(attrs as Record<string, string | true>)[key] = value
        i = close + 1
      } else if (body[i] === '"') {
        const close = body.indexOf('"', i + 1)
        if (close < 0)
          return { error: `unclosed " in attribute "${key}"` }
        const value = body.slice(i + 1, close)
        ;(attrs as Record<string, string | true>)[key] = value
        i = close + 1
      } else {
        const valueStart = i
        while (i < len && !/\s/.test(body[i])) i++
        const value = body.slice(valueStart, i)
        ;(attrs as Record<string, string | true>)[key] = value
      }
    } else {
      // Bare flag.
      ;(attrs as Record<string, string | true>)[key] = true
    }
  }
  return { attrs }
}

function classify(attrs: Attributes): Directive {
  if ('end' in attrs) {
    const id = typeof attrs.end === 'string' && attrs.end !== '' ? attrs.end : null
    // Sanity: end shouldn't carry other attrs.
    const extra = Object.keys(attrs).filter((k) => k !== 'end')
    if (extra.length > 0) {
      return {
        kind: 'invalid',
        message: `@prezl end does not accept other attributes: ${extra.join(', ')}`,
      }
    }
    return { kind: 'end', id }
  }

  if ('file' in attrs) {
    if (typeof attrs.file !== 'string') {
      return { kind: 'invalid', message: 'file= requires a stage list' }
    }
    // `focus` is the only other attribute valid alongside `file=` — it
    // highlights the file's explorer entry on matching screens (and is a
    // no-op when the file is gated out by its own `file=` selector).
    const extra = Object.keys(attrs).filter(
      (k) => k !== 'file' && k !== 'focus',
    )
    if (extra.length > 0) {
      return {
        kind: 'invalid',
        message: `@prezl file=... only accepts a sibling focus=...; got: ${extra.join(', ')}`,
      }
    }
    const focus =
      attrs.focus === true
        ? true
        : typeof attrs.focus === 'string'
          ? attrs.focus
          : null
    return { kind: 'file', stages: attrs.file, focus }
  }

  const show = typeof attrs.show === 'string' ? attrs.show : null
  const focus =
    attrs.focus === true
      ? true
      : typeof attrs.focus === 'string'
        ? attrs.focus
        : null
  const collapse =
    attrs.collapse === true
      ? true
      : typeof attrs.collapse === 'string'
        ? attrs.collapse
        : null
  const label = typeof attrs.label === 'string' ? attrs.label : null
  const id = typeof attrs.id === 'string' ? attrs.id : null

  const hasRegion = show !== null || focus !== null || collapse !== null

  if (!hasRegion) {
    if (id !== null) return { kind: 'anchor', id }
    return {
      kind: 'invalid',
      message: 'empty @prezl directive (needs id, show, focus, collapse, file, or end)',
    }
  }

  if (label !== null && collapse === null) {
    return {
      kind: 'invalid',
      message: 'label="..." only applies with collapse',
    }
  }

  return { kind: 'region', id, show, focus, collapse, label }
}

type Frame = {
  id: string | null
  openLine: number
  // Whether a `show` kept this region (true) or the region is being dropped
  // (false) from the rendered output.
  showKeeping: boolean
  showActive: boolean // whether a show was declared on the open
  collapseContentStart: number | null
  collapseStages: string | null | true
  collapseLabel: string | null
  collapseIndent: string
  focusContentStart: number | null
  focusStages: string | null | true
}

export function parseDirectives(
  source: string,
  currentScreenId: string,
  screenIndex: ScreenIndex,
): RenderedFile {
  const errors: DirectiveError[] = []
  const foldRanges: FoldRange[] = []
  const focusRanges: FocusRange[] = []
  const marks: Record<string, number> = {}
  const originalLineMap: number[] = []

  const lines = source.split(/\r?\n/)
  const out: string[] = []
  let renderedLine = 0
  const stack: Frame[] = []
  let dropDepth = 0
  let pendingMark: string | null = null
  let hiddenForStage = false
  let focusedForScreen = false
  let sawAnyContent = false

  const evaluateMatch = (selector: string): boolean => {
    const result = parseScreenList(selector, screenIndex)
    return result.ok ? result.matches(currentScreenId) : false
  }
  const validateStages = (selector: string, line: number) => {
    const result = parseScreenList(selector, screenIndex)
    if (!result.ok) errors.push({ line, message: result.error })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const directive = detectDirective(line)
    const isLastLine = i === lines.length - 1

    if (directive === null) {
      if (dropDepth === 0) {
        if (!(isLastLine && line === '')) {
          out.push(line)
          renderedLine++
          originalLineMap.push(i + 1)
          if (line.trim() !== '') sawAnyContent = true
          if (pendingMark) {
            if (marks[pendingMark] !== undefined) {
              errors.push({
                line: i + 1,
                message: `duplicate id "${pendingMark}"`,
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

    // Directive lines are always stripped from the output.
    switch (directive.kind) {
      case 'invalid':
        errors.push({ line: i + 1, message: directive.message })
        break

      case 'file': {
        if (sawAnyContent) {
          errors.push({
            line: i + 1,
            message: '@prezl file=[...] must appear before any code',
          })
          break
        }
        validateStages(directive.stages, i + 1)
        if (!evaluateMatch(directive.stages)) hiddenForStage = true
        if (directive.focus !== null) {
          if (typeof directive.focus === 'string')
            validateStages(directive.focus, i + 1)
          const matched =
            directive.focus === true || evaluateMatch(directive.focus)
          if (matched) focusedForScreen = true
        }
        break
      }

      case 'anchor': {
        if (dropDepth > 0) break
        pendingMark = directive.id
        break
      }

      case 'region': {
        if (directive.show !== null) validateStages(directive.show, i + 1)
        if (typeof directive.focus === 'string')
          validateStages(directive.focus, i + 1)
        if (typeof directive.collapse === 'string')
          validateStages(directive.collapse, i + 1)

        const parentDropping = dropDepth > 0
        const showActive = directive.show !== null
        const showKeeping =
          !showActive || (!parentDropping && evaluateMatch(directive.show!))

        const frame: Frame = {
          id: directive.id,
          openLine: i + 1,
          showActive,
          showKeeping,
          collapseContentStart: null,
          collapseStages: null,
          collapseLabel: null,
          collapseIndent: '',
          focusContentStart: null,
          focusStages: null,
        }

        if (directive.collapse !== null && (!parentDropping && showKeeping)) {
          frame.collapseContentStart = renderedLine + 1
          frame.collapseStages = directive.collapse
          frame.collapseLabel = directive.label
          frame.collapseIndent = line.match(/^[ \t]*/)?.[0] ?? ''
        }

        if (directive.focus !== null && (!parentDropping && showKeeping)) {
          frame.focusContentStart = renderedLine + 1
          frame.focusStages = directive.focus
        }

        stack.push(frame)
        if (showActive && !showKeeping) dropDepth++

        // An open region with an id acts as an anchor for the first emitted
        // content line inside it, just like @prezl id=foo on its own.
        if (directive.id !== null && !parentDropping && showKeeping) {
          pendingMark = directive.id
        }
        break
      }

      case 'end': {
        const top = stack.pop()
        if (!top) {
          errors.push({
            line: i + 1,
            message: '@prezl end with no matching open',
          })
          break
        }
        if (directive.id !== null && directive.id !== top.id) {
          errors.push({
            line: i + 1,
            message: `@prezl end=${directive.id} does not match open id=${
              top.id ?? '(none)'
            }`,
          })
          // Continue closing the frame anyway to avoid cascading errors.
        }
        if (top.showActive && !top.showKeeping) {
          dropDepth = Math.max(0, dropDepth - 1)
          break
        }
        const endLine = renderedLine
        if (
          top.collapseContentStart !== null &&
          endLine >= top.collapseContentStart
        ) {
          const stagesMatch =
            top.collapseStages === true ||
            top.collapseStages === null ||
            evaluateMatch(top.collapseStages)
          if (stagesMatch) {
            // Fold's visible header is the first content line (e.g. the line
            // with `{`). For unlabeled folds the viewer keeps that header
            // visible and appends `⋯` inline; for labeled folds it hides the
            // whole [start, end] range and renders a comment placeholder at
            // `indent` instead — taken from the opening directive's leading
            // whitespace so the placeholder sits where the `@prezl` line was.
            foldRanges.push({
              start: top.collapseContentStart,
              end: endLine,
              label: top.collapseLabel,
              indent: top.collapseIndent,
            })
          }
        }
        if (
          top.focusContentStart !== null &&
          top.focusStages !== null &&
          endLine >= top.focusContentStart
        ) {
          const stagesMatch =
            top.focusStages === true || evaluateMatch(top.focusStages)
          if (stagesMatch) {
            let start = top.focusContentStart
            let end = endLine
            while (start <= end && out[start - 1].trim() === '') start++
            while (end >= start && out[end - 1].trim() === '') end--
            if (start <= end) focusRanges.push({ start, end })
          }
        }
        break
      }
    }
  }

  for (const frame of stack) {
    errors.push({
      line: frame.openLine,
      message: `@prezl open ${
        frame.id ? `id=${frame.id} ` : ''
      }was never closed`,
    })
  }

  // Focus implies visible — a `focus=` on a file gated out by its own
  // `file=` selector is a no-op.
  if (hiddenForStage) focusedForScreen = false

  return {
    text: out.join('\n'),
    foldRanges,
    focusRanges,
    marks,
    hiddenForStage,
    focusedForScreen,
    errors,
    originalLineMap,
  }
}
