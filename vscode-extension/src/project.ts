import * as path from 'path'
import * as vscode from 'vscode'
import { parse as parseYaml } from 'yaml'

export type OpenTarget = {
  file: string | null
  line: number | null
  id: string | null
} | null

export type StepInfo = {
  alias: string
  title?: string
  /** Resolved sticky-forward open: this step's open, falling through to
   *  prior step / stage default. `null` means explicit clear. `undefined`
   *  means no opinion at any level (pane stays empty). */
  resolvedOpen: OpenTarget | undefined
  /** Combined screen id "stage.step". */
  screenId: string
}

export type StageInfo = {
  alias: string
  branch?: string
  title?: string
  reset: boolean
  /** Stage's own `open:` (pre-step inheritance). */
  defaultOpen: OpenTarget | undefined
  steps: StepInfo[]
  /** First screen id within this stage — `alias` for stepless, `alias.firstStep` otherwise. */
  firstScreenId: string
  /** Every screen id this stage produces. */
  screenIds: string[]
}

export type Project = {
  /** Absolute path to prezl.yaml/.yml. */
  manifestPath: string
  /** Absolute path to the project's `files/` directory. */
  filesRoot: string
  name: string
  stages: StageInfo[]
  /** Flat ordered list of every screen id (stage + stage.step) — the order
   *  the presenter would walk. */
  orderedScreenIds: string[]
}

const MANIFEST_NAMES = ['prezl.yaml', 'prezl.yml']

let cache:
  | { uri: string; mtime: number; project: Project | null }
  | null = null

export async function findManifest(
  workspace: vscode.WorkspaceFolder,
): Promise<vscode.Uri | null> {
  const configured = vscode.workspace
    .getConfiguration('prezl', workspace)
    .get<string>('projectFile', 'prezl.yaml')
  const candidates = [configured, ...MANIFEST_NAMES.filter((n) => n !== configured)]
  for (const name of candidates) {
    const uri = vscode.Uri.joinPath(workspace.uri, name)
    try {
      await vscode.workspace.fs.stat(uri)
      return uri
    } catch {
      // try next
    }
  }
  return null
}

export async function loadProject(
  manifestUri: vscode.Uri,
): Promise<Project | null> {
  let stat: vscode.FileStat
  try {
    stat = await vscode.workspace.fs.stat(manifestUri)
  } catch {
    cache = null
    return null
  }
  if (
    cache &&
    cache.uri === manifestUri.toString() &&
    cache.mtime === stat.mtime
  ) {
    return cache.project
  }

  let project: Project | null
  try {
    const bytes = await vscode.workspace.fs.readFile(manifestUri)
    const text = new TextDecoder('utf-8').decode(bytes)
    project = parseProject(text, manifestUri.fsPath)
  } catch {
    project = null
  }
  cache = { uri: manifestUri.toString(), mtime: stat.mtime, project }
  return project
}

export function invalidateCache(): void {
  cache = null
}

function parseProject(yaml: string, manifestPath: string): Project | null {
  let raw: unknown
  try {
    raw = parseYaml(yaml)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const root = raw as Record<string, unknown>
  const name = typeof root.name === 'string' ? root.name : ''
  const stagesRaw = Array.isArray(root.stages) ? root.stages : []

  const stages: StageInfo[] = []
  const ordered: string[] = []

  for (const sRaw of stagesRaw) {
    if (!sRaw || typeof sRaw !== 'object') continue
    const s = sRaw as Record<string, unknown>
    const alias = typeof s.alias === 'string' ? s.alias : null
    if (!alias) continue
    const defaultOpen = parseOpen(s.open)
    const stepsRaw = Array.isArray(s.steps) ? s.steps : []
    const steps: StepInfo[] = []
    const screenIds: string[] = []
    let prevOpen: OpenTarget | undefined = defaultOpen
    for (const stRaw of stepsRaw) {
      if (typeof stRaw === 'string') {
        const screenId = `${alias}.${stRaw}`
        steps.push({ alias: stRaw, resolvedOpen: prevOpen, screenId })
        screenIds.push(screenId)
        ordered.push(screenId)
        continue
      }
      if (!stRaw || typeof stRaw !== 'object') continue
      const st = stRaw as Record<string, unknown>
      const stAlias = typeof st.alias === 'string' ? st.alias : null
      if (!stAlias) continue
      const screenId = `${alias}.${stAlias}`
      let resolved: OpenTarget | undefined
      if ('open' in st) {
        if (st.open === null) {
          // Explicit reset: fall back to stage's default.
          resolved = defaultOpen
        } else {
          resolved = parseOpen(st.open)
        }
      } else {
        resolved = prevOpen
      }
      steps.push({
        alias: stAlias,
        title: typeof st.title === 'string' ? st.title : undefined,
        resolvedOpen: resolved,
        screenId,
      })
      screenIds.push(screenId)
      ordered.push(screenId)
      prevOpen = resolved
    }

    const firstScreenId = steps.length > 0 ? steps[0].screenId : alias
    if (steps.length === 0) {
      screenIds.push(alias)
      ordered.push(alias)
    }

    stages.push({
      alias,
      branch: typeof s.branch === 'string' ? s.branch : undefined,
      title: typeof s.title === 'string' ? s.title : undefined,
      reset: s.reset === true,
      defaultOpen,
      steps,
      firstScreenId,
      screenIds,
    })
  }

  const filesRoot = path.join(path.dirname(manifestPath), 'files')
  return {
    manifestPath,
    filesRoot,
    name,
    stages,
    orderedScreenIds: ordered,
  }
}

function parseOpen(raw: unknown): OpenTarget | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  if (typeof raw === 'string') {
    return { file: raw, line: null, id: null }
  }
  if (typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  return {
    file: typeof o.file === 'string' ? o.file : null,
    line: typeof o.line === 'number' ? o.line : null,
    id: typeof o.id === 'string' ? o.id : null,
  }
}

/** Resolve a screen id (e.g. "preview" or "preview.intro") to its
 *  resolved open target, walking step inheritance. Returns undefined
 *  if the screen id is unknown. */
export function resolveOpen(
  project: Project,
  screenId: string,
): OpenTarget | undefined {
  const dot = screenId.indexOf('.')
  if (dot < 0) {
    const stage = project.stages.find((s) => s.alias === screenId)
    if (!stage) return undefined
    if (stage.steps.length > 0) return stage.steps[0].resolvedOpen
    return stage.defaultOpen
  }
  const stageAlias = screenId.slice(0, dot)
  const stepAlias = screenId.slice(dot + 1)
  const stage = project.stages.find((s) => s.alias === stageAlias)
  if (!stage) return undefined
  const step = stage.steps.find((s) => s.alias === stepAlias)
  if (!step) return undefined
  return step.resolvedOpen
}

/** Convenience: every aliasable target for completion — bare stage
 *  aliases plus dotted stage.step ids. */
export function allScreenAliases(project: Project): string[] {
  const out: string[] = []
  for (const s of project.stages) {
    out.push(s.alias)
    for (const st of s.steps) out.push(`${s.alias}.${st.alias}`)
  }
  return out
}
