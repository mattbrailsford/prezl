import * as path from 'path'
import * as vscode from 'vscode'
import type { DirectiveIndex } from '../directiveIndex'
import { findManifest, loadProject, resolveOpen, type Project } from '../project'
import { scan } from '../scanner'

/** In code: clicking a screen ref inside a `[selector]` jumps to that
 *  stage/step's resolved `open` target. Clicking `@prezl end` (anywhere
 *  on the line) jumps to the matching opener — bracket-jump style. */
export class PrezlSelectorDefinitionProvider
  implements vscode.DefinitionProvider
{
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location | null> {
    const line = document.lineAt(position.line).text
    if (!/@(?:prezl|przl)\b/.test(line)) return null

    // End → opener: cursor on a `@prezl end` line jumps to the matching
    // open directive. Only relevant when the cursor isn't inside a
    // selector bracket — that path runs first.
    const ref = screenRefAtCursor(line, position.character)
    if (!ref) {
      const opener = findMatchingOpener(document, position.line)
      if (opener)
        return new vscode.Location(
          document.uri,
          new vscode.Range(opener, 0, opener, 0),
        )
      return null
    }

    const project = await currentProject(document.uri)
    if (!project) return null

    const target = resolveOpen(project, ref)
    if (!target) {
      // Maybe the user clicked a stage id that we have, but the screen
      // has no open. Fall back to opening the manifest at the stage's
      // declaration so the click still does something useful.
      return manifestStageLocation(project, ref)
    }
    if (!target.file) return manifestStageLocation(project, ref)

    const filePath = path.join(project.filesRoot, target.file)
    const fileUri = vscode.Uri.file(filePath)
    const lineNumber = (target.line ?? 1) - 1
    return new vscode.Location(
      fileUri,
      new vscode.Position(lineNumber, 0),
    )
  }
}

/** In `prezl.yaml`: clicking an `id:` value jumps to the matching
 *  `@prezl id=` anchor; clicking a `file:` value opens that file under
 *  the project's `files/` directory. */
export class PrezlYamlDefinitionProvider
  implements vscode.DefinitionProvider
{
  constructor(private readonly index: DirectiveIndex) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location | vscode.Location[] | null> {
    const lineText = document.lineAt(position.line).text

    const fileMatch = /^(\s*)file:\s*(['"]?)(.+?)\2\s*$/.exec(lineText)
    if (fileMatch && cursorInsideValue(fileMatch, position.character)) {
      const project = await currentProject(document.uri)
      if (!project) return null
      const filePath = path.join(project.filesRoot, fileMatch[3])
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
      } catch {
        return null
      }
      return new vscode.Location(
        vscode.Uri.file(filePath),
        new vscode.Position(0, 0),
      )
    }

    const idMatch = /^(\s*)id:\s*(['"]?)(.+?)\2\s*$/.exec(lineText)
    if (idMatch && cursorInsideValue(idMatch, position.character)) {
      await this.index.ensurePopulated()
      const anchors = this.index.findById(idMatch[3])
      if (anchors.length === 0) return null
      return anchors.map(
        (a) =>
          new vscode.Location(a.uri, new vscode.Range(a.line, 0, a.line, 0)),
      )
    }

    return null
  }
}

function cursorInsideValue(
  match: RegExpExecArray,
  col: number,
): boolean {
  const valueStart = (match.index ?? 0) + match[0].indexOf(match[3])
  const valueEnd = valueStart + match[3].length
  return col >= valueStart && col <= valueEnd
}

/** Locate the screen ref token (e.g. `shell` or `shell.intro`) that the
 *  cursor is positioned on, but only if the cursor is inside a bracketed
 *  selector on a directive line. Returns the screen id, or null. */
export function screenRefAtCursor(
  line: string,
  col: number,
): string | null {
  // Find every [...] range in the line.
  const brackets = findBracketRanges(line)
  const inside = brackets.find((b) => col > b.start && col <= b.end)
  if (!inside) return null
  const content = line.slice(inside.start + 1, inside.end)
  const offsetInContent = col - (inside.start + 1)

  // Tokenise content on `,` and `...`.
  let tokenStart = 0
  for (let i = 0; i <= content.length; i++) {
    const c = i < content.length ? content[i] : ','
    const isComma = c === ','
    const isRange = content.slice(i, i + 3) === '...'
    if (isComma || isRange || i === content.length) {
      const token = content.slice(tokenStart, i).trim()
      if (
        offsetInContent >= tokenStart &&
        offsetInContent <= i &&
        /^[A-Za-z_][A-Za-z0-9_.\-]*$/.test(token)
      ) {
        return token
      }
      if (isRange) i += 2
      tokenStart = i + 1
    }
  }
  return null
}

function findBracketRanges(line: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  let i = 0
  while (i < line.length) {
    const open = line.indexOf('[', i)
    if (open < 0) break
    const close = line.indexOf(']', open + 1)
    if (close < 0) break
    out.push({ start: open, end: close })
    i = close + 1
  }
  return out
}

/** If line `lineIndex` is an `@prezl end` whose pair we can identify,
 *  return the opener's 0-based line. Otherwise null. */
function findMatchingOpener(
  document: vscode.TextDocument,
  lineIndex: number,
): number | null {
  const result = scan(document.getText())
  for (const pair of result.pairs) {
    if (pair.end.line === lineIndex) return pair.open.line
    if (pair.open.line === lineIndex) return pair.end.line
  }
  return null
}

async function currentProject(docUri: vscode.Uri): Promise<Project | null> {
  const folder = vscode.workspace.getWorkspaceFolder(docUri)
  if (!folder) return null
  const manifest = await findManifest(folder)
  if (!manifest) return null
  return loadProject(manifest)
}

function manifestStageLocation(
  project: Project,
  screenId: string,
): vscode.Location | null {
  // We don't track YAML line offsets when parsing the project; fall back
  // to opening the manifest at the top.
  const stageId = screenId.split('.')[0]
  const stage = project.stages.find((s) => s.id === stageId)
  if (!stage) return null
  return new vscode.Location(
    vscode.Uri.file(project.manifestPath),
    new vscode.Position(0, 0),
  )
}
