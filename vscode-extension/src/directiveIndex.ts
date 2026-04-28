import * as vscode from 'vscode'
import { scan, type Directive } from './scanner'

export type IndexedAnchor = {
  id: string
  uri: vscode.Uri
  line: number
}

/** Workspace-wide index of `@prezl id=` anchors. Built lazily on first
 *  query and invalidated by the extension's file watcher on save / delete. */
export class DirectiveIndex {
  private byUri = new Map<string, IndexedAnchor[]>()
  private populated = false
  private populating: Promise<void> | null = null

  async ensurePopulated(token?: vscode.CancellationToken): Promise<void> {
    if (this.populated) return
    if (!this.populating) this.populating = this.populate(token)
    await this.populating
  }

  private async populate(token?: vscode.CancellationToken): Promise<void> {
    this.byUri.clear()
    const files = await vscode.workspace.findFiles(
      '**/*',
      '**/{node_modules,.git,dist,build,out,target,.next,.tauri}/**',
      5000,
    )
    for (const uri of files) {
      if (token?.isCancellationRequested) {
        this.populating = null
        return
      }
      await this.indexFile(uri)
    }
    this.populated = true
    this.populating = null
  }

  private async indexFile(uri: vscode.Uri): Promise<void> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri)
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      const result = scan(text)
      const anchors: IndexedAnchor[] = []
      for (const d of result.directives) {
        const id = idOf(d)
        if (!id) continue
        anchors.push({ id, uri, line: d.line })
      }
      if (anchors.length > 0) this.byUri.set(uri.toString(), anchors)
      else this.byUri.delete(uri.toString())
    } catch {
      this.byUri.delete(uri.toString())
    }
  }

  invalidateUri(uri: vscode.Uri): void {
    if (!this.populated) return
    void this.indexFile(uri)
  }

  removeUri(uri: vscode.Uri): void {
    this.byUri.delete(uri.toString())
  }

  invalidateAll(): void {
    this.populated = false
    this.populating = null
    this.byUri.clear()
  }

  /** All anchors with the given id (case-sensitive, like Prezl's runtime). */
  findById(id: string): IndexedAnchor[] {
    const out: IndexedAnchor[] = []
    for (const list of this.byUri.values()) {
      for (const a of list) if (a.id === id) out.push(a)
    }
    return out
  }

  /** All anchors, for workspace symbol queries. */
  all(): IndexedAnchor[] {
    const out: IndexedAnchor[] = []
    for (const list of this.byUri.values()) out.push(...list)
    return out
  }
}

function idOf(d: Directive): string | null {
  if (d.kind === 'anchor') return d.id
  if (d.kind === 'region') return d.id
  return null
}
