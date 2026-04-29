import * as path from 'path'
import * as vscode from 'vscode'
import {
  findManifest,
  invalidateCache,
  loadProject,
  resolveOpen,
  type CoverItemInfo,
  type Project,
  type StageInfo,
  type StepInfo,
} from '../project'
import { scan } from '../scanner'

type Node =
  | { kind: 'stage'; stage: StageInfo }
  | { kind: 'step'; stage: StageInfo; step: StepInfo }
  | { kind: 'cover'; ownerKey: string; index: number; item: CoverItemInfo }

export class StagesTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly emitter = new vscode.EventEmitter<Node | undefined>()
  readonly onDidChangeTreeData = this.emitter.event

  refresh(): void {
    invalidateCache()
    this.emitter.fire(undefined)
  }

  async getChildren(element?: Node): Promise<Node[]> {
    const project = await this.currentProject()
    if (!project) return []
    if (!element) return project.stages.map((stage) => ({ kind: 'stage', stage }))
    if (element.kind === 'stage') {
      const out: Node[] = []
      for (const step of element.stage.steps) {
        out.push({ kind: 'step', stage: element.stage, step })
      }
      if (element.stage.defaultCover) {
        const ownerKey = element.stage.alias
        element.stage.defaultCover.forEach((item, index) => {
          out.push({ kind: 'cover', ownerKey, index, item })
        })
      }
      return out
    }
    if (element.kind === 'step') {
      if (!element.step.ownCover) return []
      const ownerKey = element.step.screenId
      return element.step.ownCover.map((item, index) => ({
        kind: 'cover',
        ownerKey,
        index,
        item,
      }))
    }
    return []
  }

  getTreeItem(element: Node): vscode.TreeItem {
    if (element.kind === 'stage') {
      const hasChildren =
        element.stage.steps.length > 0 ||
        (element.stage.defaultCover?.length ?? 0) > 0
      const item = new vscode.TreeItem(
        element.stage.title || element.stage.alias,
        hasChildren
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      )
      item.description = element.stage.alias
      item.iconPath = new vscode.ThemeIcon(
        element.stage.reset ? 'debug-restart' : 'symbol-class',
      )
      item.tooltip = stageTooltip(element.stage)
      item.command = openCommandFor('stage', element.stage.alias)
      return item
    }
    if (element.kind === 'step') {
      const hasOwnCover = (element.step.ownCover?.length ?? 0) > 0
      const item = new vscode.TreeItem(
        element.step.title || element.step.alias,
        hasOwnCover
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      )
      item.description = element.step.alias
      item.iconPath = new vscode.ThemeIcon('symbol-event')
      item.command = openCommandFor('step', element.step.screenId)
      return item
    }
    return coverTreeItem(element.item, element.ownerKey, element.index)
  }

  private async currentProject(): Promise<Project | null> {
    const folders = vscode.workspace.workspaceFolders
    if (!folders || folders.length === 0) return null
    for (const folder of folders) {
      const manifest = await findManifest(folder)
      if (!manifest) continue
      const project = await loadProject(manifest)
      if (project) return project
    }
    return null
  }
}

function stageTooltip(stage: StageInfo): vscode.MarkdownString {
  const md = new vscode.MarkdownString()
  md.appendMarkdown(`**${stage.title || stage.alias}**\n\n`)
  if (stage.branch) md.appendMarkdown(`branch: \`${stage.branch}\`\n\n`)
  if (stage.reset) md.appendMarkdown(`_reset: true_\n\n`)
  if (stage.steps.length > 0)
    md.appendMarkdown(`steps: ${stage.steps.length}\n\n`)
  if (stage.defaultCover && stage.defaultCover.length > 0)
    md.appendMarkdown(`cover: ${stage.defaultCover.length}\n`)
  return md
}

function coverTreeItem(
  cover: CoverItemInfo,
  ownerKey: string,
  index: number,
): vscode.TreeItem {
  const label = cover.title ?? basename(cover.file)
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None)
  // Description shows the anchor / line / file context so the row stays
  // identifiable when the label is the basename or a custom title. When
  // a custom title is set, fall back to the basename so the file is still
  // visible at a glance.
  if (cover.id) {
    item.description = `#${cover.id}`
  } else if (cover.line) {
    item.description = `:${cover.line}`
  } else if (cover.title) {
    item.description = basename(cover.file)
  }
  item.iconPath = new vscode.ThemeIcon('bookmark')
  item.tooltip = coverTooltip(cover)
  item.id = `${ownerKey}#cover#${index}`
  item.command = {
    command: 'prezl.openCoverItem',
    title: 'Open cover item',
    arguments: [{ ...cover }],
  }
  return item
}

function coverTooltip(cover: CoverItemInfo): vscode.MarkdownString {
  const md = new vscode.MarkdownString()
  md.appendMarkdown(`\`${cover.file}\``)
  if (cover.id) md.appendMarkdown(` · id \`${cover.id}\``)
  if (cover.line) md.appendMarkdown(` · line ${cover.line}`)
  return md
}

function basename(p: string): string {
  const i = p.lastIndexOf('/')
  return i < 0 ? p : p.slice(i + 1)
}

function openCommandFor(kind: 'stage' | 'step', id: string): vscode.Command {
  return {
    command: 'prezl.openScreen',
    title: 'Open screen',
    arguments: [{ kind, id }],
  }
}

export async function openScreenCommand(arg: {
  kind: 'stage' | 'step'
  id: string
}): Promise<void> {
  const folders = vscode.workspace.workspaceFolders
  if (!folders) return
  for (const folder of folders) {
    const manifest = await findManifest(folder)
    if (!manifest) continue
    const project = await loadProject(manifest)
    if (!project) continue
    const target = resolveOpen(project, arg.id)
    if (!target || !target.file) {
      void vscode.window.showInformationMessage(
        `No \`open\` defined for ${arg.id}.`,
      )
      return
    }
    const filePath = path.join(project.filesRoot, target.file)
    const uri = vscode.Uri.file(filePath)
    const lineNumber = (target.line ?? 1) - 1
    const doc = await vscode.workspace.openTextDocument(uri)
    const editor = await vscode.window.showTextDocument(doc)
    const pos = new vscode.Position(lineNumber, 0)
    editor.selection = new vscode.Selection(pos, pos)
    editor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenter,
    )
    return
  }
}

/** Open a cover item: resolve `id` against the file's `@prezl` anchors
 *  when present, otherwise honour `line`, otherwise open at line 1. */
export async function openCoverItemCommand(
  arg: CoverItemInfo,
): Promise<void> {
  const folders = vscode.workspace.workspaceFolders
  if (!folders) return
  for (const folder of folders) {
    const manifest = await findManifest(folder)
    if (!manifest) continue
    const project = await loadProject(manifest)
    if (!project) continue

    const filePath = path.join(project.filesRoot, arg.file)
    const uri = vscode.Uri.file(filePath)
    let doc: vscode.TextDocument
    try {
      doc = await vscode.workspace.openTextDocument(uri)
    } catch {
      void vscode.window.showWarningMessage(
        `Cover file not found: ${arg.file}`,
      )
      return
    }

    let lineNumber = 0
    if (arg.id) {
      const anchorLine = findAnchorLine(doc.getText(), arg.id)
      if (anchorLine !== null) {
        lineNumber = anchorLine
      } else if (arg.line) {
        lineNumber = arg.line - 1
      }
    } else if (arg.line) {
      lineNumber = arg.line - 1
    }

    const editor = await vscode.window.showTextDocument(doc)
    const pos = new vscode.Position(lineNumber, 0)
    editor.selection = new vscode.Selection(pos, pos)
    editor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenter,
    )
    return
  }
}

function findAnchorLine(text: string, id: string): number | null {
  const result = scan(text)
  for (const d of result.directives) {
    if ((d.kind === 'anchor' || d.kind === 'region') && d.id === id) {
      return d.line
    }
  }
  return null
}
