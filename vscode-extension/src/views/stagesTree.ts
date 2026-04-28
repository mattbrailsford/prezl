import * as path from 'path'
import * as vscode from 'vscode'
import {
  findManifest,
  invalidateCache,
  loadProject,
  resolveOpen,
  type Project,
  type StageInfo,
  type StepInfo,
} from '../project'

type Node =
  | { kind: 'stage'; stage: StageInfo }
  | { kind: 'step'; stage: StageInfo; step: StepInfo }

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
      return element.stage.steps.map((step) => ({
        kind: 'step',
        stage: element.stage,
        step,
      }))
    }
    return []
  }

  getTreeItem(element: Node): vscode.TreeItem {
    if (element.kind === 'stage') {
      const item = new vscode.TreeItem(
        element.stage.title || element.stage.alias,
        element.stage.steps.length > 0
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
    const item = new vscode.TreeItem(
      element.step.title || element.step.alias,
      vscode.TreeItemCollapsibleState.None,
    )
    item.description = element.step.alias
    item.iconPath = new vscode.ThemeIcon('symbol-event')
    item.command = openCommandFor('step', element.step.screenId)
    return item
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
    md.appendMarkdown(`steps: ${stage.steps.length}\n`)
  return md
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
