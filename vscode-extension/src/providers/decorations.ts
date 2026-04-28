// Decoration-based directive coloring. tmGrammar injection works for most
// languages, but C#'s line-comment grammar uses begin/while where the
// while regex consumes entire continuation lines — that structurally
// prevents any pattern or injection from running on lines 2+ of a
// multi-line `//` block. Decorations apply after tokenization, so they
// reliably override comment scoping (and Roslyn semantic tokens) wherever
// a directive line lives.

import * as vscode from 'vscode'

const DIRECTIVE_LINE_RE =
  /^(\s*)(\/\/|#|--)\s*(@(?:prezl|przl))\b([^\r\n]*)$/

const DIRECTIVE_BLOCK_RE =
  /^(\s*)(\/\*|<!--|@\*)\s*(@(?:prezl|przl))\b([\s\S]*?)(\*\/|-->|\*@)\s*$/

const ATTR_NAMES = new Set([
  'id',
  'show',
  'focus',
  'collapse',
  'label',
  'file',
  'end',
])

type DecorationKey =
  | 'keyword'
  | 'attribute'
  | 'string'
  | 'selector'
  | 'value'
  | 'punctuation'

const decorationTypes: Record<DecorationKey, vscode.TextEditorDecorationType> =
  {
    keyword: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('prezl.directive.keyword'),
    }),
    attribute: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('prezl.directive.attribute'),
    }),
    string: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('prezl.directive.string'),
    }),
    selector: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('prezl.directive.selector'),
    }),
    value: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('prezl.directive.value'),
    }),
    punctuation: vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor('prezl.directive.punctuation'),
    }),
  }

export function activateDirectiveDecorations(
  context: vscode.ExtensionContext,
): void {
  for (const k of Object.keys(decorationTypes) as DecorationKey[]) {
    context.subscriptions.push(decorationTypes[k])
  }

  const debounce = new Map<string, NodeJS.Timeout>()
  const scheduleEditor = (editor: vscode.TextEditor): void => {
    const key = editor.document.uri.toString()
    const prev = debounce.get(key)
    if (prev) clearTimeout(prev)
    debounce.set(
      key,
      setTimeout(() => {
        debounce.delete(key)
        decorate(editor)
      }, 50),
    )
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e) decorate(e)
    }),
    vscode.window.onDidChangeVisibleTextEditors((eds) => {
      for (const e of eds) decorate(e)
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === e.document) scheduleEditor(editor)
      }
    }),
  )

  for (const editor of vscode.window.visibleTextEditors) decorate(editor)
}

function decorate(editor: vscode.TextEditor): void {
  const ranges: Record<DecorationKey, vscode.Range[]> = {
    keyword: [],
    attribute: [],
    string: [],
    selector: [],
    value: [],
    punctuation: [],
  }

  const text = editor.document.getText()
  const lines = text.split(/\r?\n/)

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo]

    const lineMatch = DIRECTIVE_LINE_RE.exec(line)
    if (lineMatch) {
      const keyword = lineMatch[3]
      const body = lineMatch[4] ?? ''
      const keywordStart = line.indexOf(keyword)
      addRanges(ranges, lineNo, keywordStart, keyword.length, body)
      continue
    }

    const blockMatch = DIRECTIVE_BLOCK_RE.exec(line)
    if (blockMatch) {
      const keyword = blockMatch[3]
      const body = blockMatch[4] ?? ''
      const keywordStart = line.indexOf(keyword)
      addRanges(ranges, lineNo, keywordStart, keyword.length, body)
    }
  }

  for (const k of Object.keys(decorationTypes) as DecorationKey[]) {
    editor.setDecorations(decorationTypes[k], ranges[k])
  }
}

function addRanges(
  ranges: Record<DecorationKey, vscode.Range[]>,
  lineNo: number,
  keywordStart: number,
  keywordLength: number,
  body: string,
): void {
  ranges.keyword.push(
    new vscode.Range(
      lineNo,
      keywordStart,
      lineNo,
      keywordStart + keywordLength,
    ),
  )

  const bodyStart = keywordStart + keywordLength
  let i = 0
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++
    if (i >= body.length) break

    const keyStart = i
    while (i < body.length && /[A-Za-z_]/.test(body[i])) i++
    const key = body.slice(keyStart, i)
    if (key.length > 0) {
      const startCol = bodyStart + keyStart
      const endCol = bodyStart + i
      const target =
        ATTR_NAMES.has(key) ? ranges.attribute : ranges.value
      target.push(new vscode.Range(lineNo, startCol, lineNo, endCol))
    }

    if (i < body.length && body[i] === '=') {
      ranges.punctuation.push(
        new vscode.Range(lineNo, bodyStart + i, lineNo, bodyStart + i + 1),
      )
      i++
      if (i >= body.length) continue

      if (body[i] === '"') {
        const close = body.indexOf('"', i + 1)
        const end = close < 0 ? body.length : close + 1
        ranges.string.push(
          new vscode.Range(lineNo, bodyStart + i, lineNo, bodyStart + end),
        )
        i = end
      } else if (body[i] === '[') {
        const close = body.indexOf(']', i + 1)
        const end = close < 0 ? body.length : close + 1
        ranges.punctuation.push(
          new vscode.Range(
            lineNo,
            bodyStart + i,
            lineNo,
            bodyStart + i + 1,
          ),
        )
        const innerEnd = close < 0 ? body.length : close
        addSelectorRanges(ranges, lineNo, bodyStart, body, i + 1, innerEnd)
        if (close >= 0) {
          ranges.punctuation.push(
            new vscode.Range(
              lineNo,
              bodyStart + close,
              lineNo,
              bodyStart + close + 1,
            ),
          )
        }
        i = end
      } else {
        const valStart = i
        while (i < body.length && !/\s/.test(body[i])) i++
        ranges.value.push(
          new vscode.Range(
            lineNo,
            bodyStart + valStart,
            lineNo,
            bodyStart + i,
          ),
        )
      }
    }
  }
}

function addSelectorRanges(
  ranges: Record<DecorationKey, vscode.Range[]>,
  lineNo: number,
  bodyStart: number,
  body: string,
  start: number,
  end: number,
): void {
  let i = start
  while (i < end) {
    if (/\s/.test(body[i])) {
      i++
      continue
    }
    if (body[i] === ',') {
      ranges.punctuation.push(
        new vscode.Range(lineNo, bodyStart + i, lineNo, bodyStart + i + 1),
      )
      i++
      continue
    }
    if (body[i] === '.' && body[i + 1] === '.' && body[i + 2] === '.') {
      ranges.punctuation.push(
        new vscode.Range(lineNo, bodyStart + i, lineNo, bodyStart + i + 3),
      )
      i += 3
      continue
    }
    if (/[A-Za-z_]/.test(body[i])) {
      const refStart = i
      while (i < end && /[A-Za-z0-9_-]/.test(body[i])) i++
      ranges.selector.push(
        new vscode.Range(
          lineNo,
          bodyStart + refStart,
          lineNo,
          bodyStart + i,
        ),
      )
      if (body[i] === '.') {
        ranges.punctuation.push(
          new vscode.Range(
            lineNo,
            bodyStart + i,
            lineNo,
            bodyStart + i + 1,
          ),
        )
        i++
        const stepStart = i
        while (i < end && /[A-Za-z0-9_-]/.test(body[i])) i++
        if (i > stepStart) {
          ranges.selector.push(
            new vscode.Range(
              lineNo,
              bodyStart + stepStart,
              lineNo,
              bodyStart + i,
            ),
          )
        }
      }
      continue
    }
    i++
  }
}
