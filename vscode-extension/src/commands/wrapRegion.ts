import * as vscode from 'vscode'
import { allScreenIds, findManifest, loadProject } from '../project'

type RegionKind = 'show' | 'focus' | 'collapse'

export async function wrapRegionCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    void vscode.window.showInformationMessage(
      'Open a file and select code to wrap.',
    )
    return
  }

  const kind = await pickKind()
  if (!kind) return

  const wantsLabel =
    kind === 'collapse'
      ? (await pickYesNo('Add a label="…" placeholder?')) === 'yes'
      : false

  const selector = await pickSelector(editor.document.uri, kind)
  if (selector === undefined) return

  const labelPart = wantsLabel ? ' label="${2:label}"' : ''
  const selectorPart =
    selector === ''
      ? '' // bare flag — only valid for focus/collapse
      : `=[\${1:${escapeSnippetText(selector)}}]`

  const opener = `$LINE_COMMENT @prezl ${kind}${selectorPart}${labelPart}`
  const closer = '$LINE_COMMENT @prezl end'
  const body =
    kind === 'collapse' && wantsLabel
      ? `${opener}\n\${TM_SELECTED_TEXT:\${3:body}}\n${closer}\n$0`
      : `${opener}\n\${TM_SELECTED_TEXT:\${2:body}}\n${closer}\n$0`

  await editor.insertSnippet(new vscode.SnippetString(body))
}

async function pickKind(): Promise<RegionKind | null> {
  const items: (vscode.QuickPickItem & { value: RegionKind })[] = [
    {
      label: 'Show region',
      description:
        'visible only on listed screens — `@prezl show=[selector]`',
      value: 'show',
    },
    {
      label: 'Focus region',
      description: 'highlight on listed screens — `@prezl focus=[selector]`',
      value: 'focus',
    },
    {
      label: 'Collapse region',
      description:
        'folded on listed screens — `@prezl collapse=[selector]`',
      value: 'collapse',
    },
  ]
  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: 'What kind of region?',
  })
  return pick?.value ?? null
}

async function pickYesNo(prompt: string): Promise<'yes' | 'no' | null> {
  const pick = await vscode.window.showQuickPick(['no', 'yes'], {
    placeHolder: prompt,
  })
  if (!pick) return null
  return pick === 'yes' ? 'yes' : 'no'
}

async function pickSelector(
  docUri: vscode.Uri,
  kind: RegionKind,
): Promise<string | undefined> {
  const folder = vscode.workspace.getWorkspaceFolder(docUri)
  const manifest = folder ? await findManifest(folder) : null
  const project = manifest ? await loadProject(manifest) : null
  const ids = project ? allScreenIds(project) : []

  const items: vscode.QuickPickItem[] = []
  if (kind !== 'show') {
    items.push({
      label: '$(circle-large-outline) (always)',
      description: `bare ${kind} flag — every screen`,
      detail: 'Inserts `@prezl ' + kind + '` with no selector.',
    })
  }
  for (const id of ids) {
    items.push({
      label: id,
      description: id.includes('.') ? 'screen' : 'stage',
    })
  }

  const qp = vscode.window.createQuickPick()
  qp.title = `Selector for ${kind}=[…]`
  qp.placeholder =
    ids.length > 0
      ? 'Pick a stage/screen, or type your own (e.g. shell.intro, shell...demo)'
      : 'No prezl.yaml found — type the selector manually'
  qp.items = items
  qp.canSelectMany = false
  qp.ignoreFocusOut = false
  qp.matchOnDescription = true

  return new Promise<string | undefined>((resolve) => {
    let resolved = false
    qp.onDidAccept(() => {
      if (resolved) return
      resolved = true
      const selected = qp.selectedItems[0]
      const value =
        selected && !selected.label.startsWith('$(')
          ? selected.label
          : selected?.label.startsWith('$(')
            ? '' // (always)
            : qp.value.trim()
      qp.hide()
      resolve(value)
    })
    qp.onDidHide(() => {
      qp.dispose()
      if (!resolved) resolve(undefined)
    })
    qp.show()
  })
}

function escapeSnippetText(text: string): string {
  return text.replace(/\$/g, '\\$').replace(/}/g, '\\}')
}
