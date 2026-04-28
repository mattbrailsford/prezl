// Regex scanner for @prezl directives. Mirrors the recognizer in
// src/project/directiveParser.ts but doesn't evaluate selectors or
// strip comments — we only need structural info: where directives are,
// what kind they are, and how regions pair up.

const LINE_RE =
  /^\s*(?:\/\/|#|--)\s*@(?:prezl|przl)\b\s*([^\r\n]*?)\s*$/
const BLOCK_RE = /^\s*\/\*\s*@(?:prezl|przl)\b\s*([\s\S]*?)\s*\*\/\s*$/
const HTML_RE = /^\s*<!--\s*@(?:prezl|przl)\b\s*([\s\S]*?)\s*-->\s*$/
const RAZOR_RE = /^\s*@\*\s*@(?:prezl|przl)\b\s*([\s\S]*?)\s*\*@\s*$/

export type Attribute = {
  key: string
  /** true for bare flags, string otherwise. */
  value: string | true
  /** 0-based char offset within the directive line where the attribute begins. */
  column: number
}

export type Directive =
  | { kind: 'anchor'; line: number; column: number; id: string; attrs: Attribute[] }
  | {
      kind: 'region'
      line: number
      column: number
      id: string | null
      show: string | null
      focus: string | true | null
      collapse: string | true | null
      label: string | null
      attrs: Attribute[]
    }
  | { kind: 'end'; line: number; column: number; id: string | null; attrs: Attribute[] }
  | { kind: 'file'; line: number; column: number; selector: string; attrs: Attribute[] }
  | { kind: 'invalid'; line: number; column: number; message: string; attrs: Attribute[] }

export type RegionPair = {
  open: Directive & { kind: 'region' | 'anchor' }
  end: Directive & { kind: 'end' }
}

/** A directive that opens an unclosed block (no matching `end`). */
export type UnclosedRegion = Directive & { kind: 'region' }

export type ScanResult = {
  directives: Directive[]
  /** Region directives paired with their matching `end`. Anchors with no
   *  region attributes don't pair — they're standalone. */
  pairs: RegionPair[]
  unclosed: UnclosedRegion[]
}

/** Directive-detected line offset within the document. */
function detect(rawLine: string): { body: string; column: number } | null {
  const lineMatch = LINE_RE.exec(rawLine)
  if (lineMatch) {
    const at = rawLine.indexOf('@')
    return { body: lineMatch[1] ?? '', column: at }
  }
  const blockMatch = BLOCK_RE.exec(rawLine)
  if (blockMatch) {
    const at = rawLine.indexOf('@', rawLine.indexOf('/*'))
    return { body: blockMatch[1] ?? '', column: at }
  }
  const htmlMatch = HTML_RE.exec(rawLine)
  if (htmlMatch) {
    const at = rawLine.indexOf('@', rawLine.indexOf('<!--'))
    return { body: htmlMatch[1] ?? '', column: at }
  }
  const razorMatch = RAZOR_RE.exec(rawLine)
  if (razorMatch) {
    const at = rawLine.indexOf('@prezl')
    const at2 = at >= 0 ? at : rawLine.indexOf('@przl')
    return { body: razorMatch[1] ?? '', column: at2 }
  }
  return null
}

function tokenizeAttributes(
  body: string,
  bodyStart: number,
): { attrs: Attribute[] } | { error: string } {
  const attrs: Attribute[] = []
  let i = 0
  const len = body.length
  while (i < len) {
    while (i < len && /\s/.test(body[i])) i++
    if (i >= len) break
    const keyStart = i
    while (i < len && /[A-Za-z_]/.test(body[i])) i++
    const key = body.slice(keyStart, i)
    if (key === '') return { error: `unexpected character "${body[i]}"` }
    let value: string | true = true
    if (i < len && body[i] === '=') {
      i++
      if (i >= len) return { error: `missing value for attribute "${key}"` }
      if (body[i] === '[') {
        const close = body.indexOf(']', i + 1)
        if (close < 0) return { error: `unclosed [ in attribute "${key}"` }
        value = body.slice(i + 1, close)
        i = close + 1
      } else if (body[i] === '"') {
        const close = body.indexOf('"', i + 1)
        if (close < 0) return { error: `unclosed " in attribute "${key}"` }
        value = body.slice(i + 1, close)
        i = close + 1
      } else {
        const valueStart = i
        while (i < len && !/\s/.test(body[i])) i++
        value = body.slice(valueStart, i)
      }
    }
    attrs.push({ key, value, column: bodyStart + keyStart })
  }
  return { attrs }
}

function classify(
  line: number,
  column: number,
  attrs: Attribute[],
): Directive {
  const map = new Map<string, string | true>()
  for (const a of attrs) map.set(a.key, a.value)

  if (map.has('end')) {
    const v = map.get('end')!
    const id = typeof v === 'string' && v !== '' ? v : null
    return { kind: 'end', line, column, id, attrs }
  }
  if (map.has('file')) {
    const v = map.get('file')!
    if (typeof v !== 'string')
      return {
        kind: 'invalid',
        line,
        column,
        message: 'file= requires a stage list',
        attrs,
      }
    return { kind: 'file', line, column, selector: v, attrs }
  }

  const show = stringOrNull(map.get('show'))
  const focus = stringOrTrueOrNull(map.get('focus'))
  const collapse = stringOrTrueOrNull(map.get('collapse'))
  const label = stringOrNull(map.get('label'))
  const id = stringOrNull(map.get('id'))

  const hasRegion = show !== null || focus !== null || collapse !== null
  if (!hasRegion) {
    if (id !== null) return { kind: 'anchor', line, column, id, attrs }
    return {
      kind: 'invalid',
      line,
      column,
      message:
        'empty @prezl directive (needs id, show, focus, collapse, file, or end)',
      attrs,
    }
  }

  return { kind: 'region', line, column, id, show, focus, collapse, label, attrs }
}

function stringOrNull(v: string | true | undefined): string | null {
  return typeof v === 'string' ? v : null
}
function stringOrTrueOrNull(
  v: string | true | undefined,
): string | true | null {
  if (v === undefined) return null
  return v
}

/** Scan a document for all directives and pair regions with their ends. */
export function scan(text: string): ScanResult {
  const directives: Directive[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const detected = detect(line)
    if (!detected) continue
    const prefixMatch = /@(?:prezl|przl)\b\s*/.exec(line)
    const bodyStart = prefixMatch
      ? prefixMatch.index + prefixMatch[0].length
      : detected.column
    const tokens = tokenizeAttributes(detected.body, bodyStart)
    if ('error' in tokens) {
      directives.push({
        kind: 'invalid',
        line: i,
        column: detected.column,
        message: tokens.error,
        attrs: [],
      })
      continue
    }
    directives.push(classify(i, detected.column, tokens.attrs))
  }

  const pairs: RegionPair[] = []
  const unclosed: UnclosedRegion[] = []
  const stack: (Directive & { kind: 'region' })[] = []
  for (const d of directives) {
    if (d.kind === 'region') {
      stack.push(d)
    } else if (d.kind === 'end') {
      const open = stack.pop()
      if (open) pairs.push({ open, end: d })
    }
  }
  while (stack.length) unclosed.push(stack.shift()!)
  return { directives, pairs, unclosed }
}
