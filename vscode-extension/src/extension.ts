import * as vscode from 'vscode'
import { DirectiveIndex } from './directiveIndex'
import { findManifest, invalidateCache } from './project'
import {
  PrezlDocumentSymbolProvider,
  PrezlWorkspaceSymbolProvider,
} from './providers/symbols'
import {
  PrezlSelectorDefinitionProvider,
  PrezlYamlDefinitionProvider,
} from './providers/definition'
import { PrezlMatchHighlightProvider } from './providers/highlight'
import { PrezlSelectorCompletionProvider } from './providers/completion'
import { activateDirectiveDecorations } from './providers/decorations'
import { wrapRegionCommand } from './commands/wrapRegion'
import {
  StagesTreeProvider,
  openScreenCommand,
} from './views/stagesTree'

const ALL_FILES: vscode.DocumentSelector = [{ scheme: 'file' }]
const YAML_FILES: vscode.DocumentSelector = [
  { scheme: 'file', language: 'yaml', pattern: '**/prezl.{yaml,yml}' },
]

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const directiveIndex = new DirectiveIndex()

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      ALL_FILES,
      new PrezlDocumentSymbolProvider(),
    ),
    vscode.languages.registerWorkspaceSymbolProvider(
      new PrezlWorkspaceSymbolProvider(directiveIndex),
    ),
    vscode.languages.registerDefinitionProvider(
      ALL_FILES,
      new PrezlSelectorDefinitionProvider(),
    ),
    vscode.languages.registerDefinitionProvider(
      YAML_FILES,
      new PrezlYamlDefinitionProvider(directiveIndex),
    ),
    vscode.languages.registerCompletionItemProvider(
      ALL_FILES,
      new PrezlSelectorCompletionProvider(),
      '[',
      ',',
      '.',
      '=',
    ),
    vscode.languages.registerDocumentHighlightProvider(
      ALL_FILES,
      new PrezlMatchHighlightProvider(),
    ),
  )

  activateDirectiveDecorations(context)

  const tree = new StagesTreeProvider()
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('prezl.stages', tree),
    vscode.commands.registerCommand('prezl.refreshStages', () => tree.refresh()),
    vscode.commands.registerCommand('prezl.wrapRegion', wrapRegionCommand),
    vscode.commands.registerCommand('prezl.openScreen', openScreenCommand),
  )

  // Toggle the activity-bar view based on whether a manifest exists in
  // any workspace folder.
  await updateContextKey()

  const yamlWatcher = vscode.workspace.createFileSystemWatcher(
    '**/prezl.{yaml,yml}',
  )
  yamlWatcher.onDidChange(() => {
    invalidateCache()
    tree.refresh()
  })
  yamlWatcher.onDidCreate(() => {
    invalidateCache()
    void updateContextKey()
    tree.refresh()
  })
  yamlWatcher.onDidDelete(() => {
    invalidateCache()
    void updateContextKey()
    tree.refresh()
  })
  context.subscriptions.push(yamlWatcher)

  // Keep the directive index fresh.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      directiveIndex.invalidateUri(doc.uri)
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      for (const uri of e.files) directiveIndex.removeUri(uri)
    }),
    vscode.workspace.onDidRenameFiles((e) => {
      for (const r of e.files) {
        directiveIndex.removeUri(r.oldUri)
        directiveIndex.invalidateUri(r.newUri)
      }
    }),
  )
}

export function deactivate(): void {
  // Subscriptions disposed by VS Code.
}

async function updateContextKey(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? []
  let found = false
  for (const folder of folders) {
    if (await findManifest(folder)) {
      found = true
      break
    }
  }
  await vscode.commands.executeCommand(
    'setContext',
    'prezl.hasProject',
    found,
  )
}
