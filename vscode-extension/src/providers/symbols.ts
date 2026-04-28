import * as vscode from 'vscode'
import { scan, type Directive } from '../scanner'
import type { DirectiveIndex } from '../directiveIndex'

/** Document-level symbols for the current file's `@prezl id=` anchors. */
export class PrezlDocumentSymbolProvider
  implements vscode.DocumentSymbolProvider
{
  provideDocumentSymbols(
    document: vscode.TextDocument,
  ): vscode.DocumentSymbol[] {
    const result = scan(document.getText())
    const symbols: vscode.DocumentSymbol[] = []
    for (const d of result.directives) {
      const id = idFromDirective(d)
      if (!id) continue
      const range = document.lineAt(d.line).range
      symbols.push(
        new vscode.DocumentSymbol(
          id,
          detailFromDirective(d),
          vscode.SymbolKind.Constant,
          range,
          range,
        ),
      )
    }
    return symbols
  }
}

/** Workspace symbols backed by the shared DirectiveIndex. */
export class PrezlWorkspaceSymbolProvider
  implements vscode.WorkspaceSymbolProvider
{
  constructor(private readonly index: DirectiveIndex) {}

  async provideWorkspaceSymbols(
    query: string,
    token: vscode.CancellationToken,
  ): Promise<vscode.SymbolInformation[]> {
    await this.index.ensurePopulated(token)
    if (token.isCancellationRequested) return []
    const lower = query.toLowerCase()
    const out: vscode.SymbolInformation[] = []
    for (const a of this.index.all()) {
      if (lower !== '' && !a.id.toLowerCase().includes(lower)) continue
      out.push(
        new vscode.SymbolInformation(
          a.id,
          vscode.SymbolKind.Constant,
          '',
          new vscode.Location(a.uri, new vscode.Range(a.line, 0, a.line, 0)),
        ),
      )
    }
    return out
  }
}

function idFromDirective(d: Directive): string | null {
  if (d.kind === 'anchor') return d.id
  if (d.kind === 'region') return d.id
  return null
}

function detailFromDirective(d: Directive): string {
  if (d.kind === 'region') {
    const parts: string[] = []
    if (d.show !== null) parts.push(`show=[${d.show}]`)
    if (d.collapse !== null)
      parts.push(d.collapse === true ? 'collapse' : `collapse=[${d.collapse}]`)
    if (d.focus !== null)
      parts.push(d.focus === true ? 'focus' : `focus=[${d.focus}]`)
    if (d.label !== null) parts.push(`label="${d.label}"`)
    return parts.join(' ')
  }
  return ''
}
