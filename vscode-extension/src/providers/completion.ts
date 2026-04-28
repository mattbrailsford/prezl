import * as vscode from 'vscode'
import { scan } from '../scanner'
import { allScreenAliases, findManifest, loadProject } from '../project'

/** Inside `[...]` on a directive line, completes stage/screen aliases.
 *  After `end=`, completes ids of open regions on the stack at cursor. */
export class PrezlSelectorCompletionProvider
  implements vscode.CompletionItemProvider
{
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    const line = document.lineAt(position.line).text
    if (!/@(?:prezl|przl)\b/.test(line)) return []

    const before = line.slice(0, position.character)

    // `end=` completion — suggest ids of currently-open regions.
    const endMatch = /\bend\s*=\s*([A-Za-z0-9_-]*)$/.exec(before)
    if (endMatch) {
      return this.completeOpenIds(document, position)
    }

    // Selector completion — only when cursor is inside an unclosed `[...]`.
    if (!isInsideOpenBracket(before)) return []

    const folder = vscode.workspace.getWorkspaceFolder(document.uri)
    if (!folder) return []
    const manifest = await findManifest(folder)
    if (!manifest) return []
    const project = await loadProject(manifest)
    if (!project) return []

    const aliases = allScreenAliases(project)
    return aliases.map((alias) => {
      const item = new vscode.CompletionItem(
        alias,
        alias.includes('.')
          ? vscode.CompletionItemKind.EnumMember
          : vscode.CompletionItemKind.Enum,
      )
      const stageAlias = alias.split('.')[0]
      const stage = project.stages.find((s) => s.alias === stageAlias)
      if (stage?.title) item.detail = stage.title
      return item
    })
  }

  private completeOpenIds(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] {
    // Scan the document up to cursor, track the open-region stack, surface
    // any id from currently-open frames.
    const truncated = document.getText(
      new vscode.Range(0, 0, position.line, position.character),
    )
    const result = scan(truncated)
    const open = result.unclosed
      .map((d) => d.id)
      .filter((id): id is string => id !== null)
    return open.map((id) => {
      const item = new vscode.CompletionItem(
        id,
        vscode.CompletionItemKind.Property,
      )
      item.detail = 'open region id'
      return item
    })
  }
}

function isInsideOpenBracket(beforeCursor: string): boolean {
  const lastOpen = beforeCursor.lastIndexOf('[')
  if (lastOpen < 0) return false
  const lastClose = beforeCursor.lastIndexOf(']')
  return lastOpen > lastClose
}
