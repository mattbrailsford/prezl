import * as path from 'path'
import * as vscode from 'vscode'
import { parse as parseYaml } from 'yaml'

export type OpenTarget = {
  file: string | null
  line: number | null
  id: string | null
} | null

export type CoverFileItemInfo = {
  kind: 'file'
  file: string
  line: number | null
  id: string | null
  title: string | null
}

export type CoverDemoItemInfo = {
  kind: 'demo'
  demoId: string
  title: string | null
}

export type CoverItemInfo = CoverFileItemInfo | CoverDemoItemInfo

export type StepInfo = {
  id: string
  title?: string
  /** Resolved sticky-forward open: this step's open, falling through to
   *  prior step / stage default. `null` means explicit clear. `undefined`
   *  means no opinion at any level (pane stays empty). */
  resolvedOpen: OpenTarget | undefined
  /** Step-level cover only when the author explicitly wrote a `cover:`
   *  array on this step — drives whether the tree view surfaces a per-step
   *  agenda below the step. `undefined` covers both "inherited" and
   *  "explicitly reset to stage default", which both render under the
   *  stage instead. */
  ownCover: CoverItemInfo[] | undefined
  /** Combined screen id "stage.step". */
  screenId: string
}

export type StageInfo = {
  id: string
  branch?: string
  title?: string
  reset: boolean
  /** Stage's own `open:` (pre-step inheritance). */
  defaultOpen: OpenTarget | undefined
  /** Stage's own `cover:` agenda. Surfaced as children of the stage in
   *  the tree view; steps with an own override surface theirs instead. */
  defaultCover: CoverItemInfo[] | undefined
  steps: StepInfo[]
  /** First screen id within this stage — `id` for stepless, `id.firstStep` otherwise. */
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
    const id = typeof s.id === 'string' ? s.id : null
    if (!id) continue
    const defaultOpen = parseOpen(s.open)
    const defaultCover = parseCover(s.cover)
    const stepsRaw = Array.isArray(s.steps) ? s.steps : []
    const steps: StepInfo[] = []
    const screenIds: string[] = []
    let prevOpen: OpenTarget | undefined = defaultOpen
    for (const stRaw of stepsRaw) {
      if (typeof stRaw === 'string') {
        const screenId = `${id}.${stRaw}`
        steps.push({
          id: stRaw,
          resolvedOpen: prevOpen,
          ownCover: undefined,
          screenId,
        })
        screenIds.push(screenId)
        ordered.push(screenId)
        continue
      }
      if (!stRaw || typeof stRaw !== 'object') continue
      const st = stRaw as Record<string, unknown>
      const stId = typeof st.id === 'string' ? st.id : null
      if (!stId) continue
      const screenId = `${id}.${stId}`
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
      // Step cover is tri-state. Surface a per-step agenda in the tree
      // when the author wrote an explicit value (single item or array);
      // omitted (inherit from stage) and null (explicitly empty for this
      // step) both leave ownCover undefined, falling back to the stage's
      // cover under the stage node.
      let ownCover: CoverItemInfo[] | undefined
      if ('cover' in st && st.cover !== null && st.cover !== undefined) {
        ownCover = parseCover(st.cover)
      }
      steps.push({
        id: stId,
        title: typeof st.title === 'string' ? st.title : undefined,
        resolvedOpen: resolved,
        ownCover,
        screenId,
      })
      screenIds.push(screenId)
      ordered.push(screenId)
      prevOpen = resolved
    }

    const firstScreenId = steps.length > 0 ? steps[0].screenId : id
    if (steps.length === 0) {
      screenIds.push(id)
      ordered.push(id)
    }

    stages.push({
      id,
      branch: typeof s.branch === 'string' ? s.branch : undefined,
      title: typeof s.title === 'string' ? s.title : undefined,
      reset: s.reset === true,
      defaultOpen,
      defaultCover,
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

function parseCover(raw: unknown): CoverItemInfo[] | undefined {
  // Cover accepts either a single item (string shorthand or object form,
  // mirroring demo's single-object shorthand) or an explicit array.
  if (raw === undefined || raw === null) return undefined
  if (Array.isArray(raw)) {
    const out: CoverItemInfo[] = []
    for (const item of raw) {
      const parsed = parseCoverItem(item)
      if (parsed) out.push(parsed)
    }
    return out.length > 0 ? out : undefined
  }
  const single = parseCoverItem(raw)
  return single ? [single] : undefined
}

const DEMO_PREFIX = 'demo://'

/** Mirror of the runtime cover-item parser in `src/project/schema.ts`.
 *  Two shapes:
 *  - File: `path[#id][@line]` shorthand or `{ file, id?, line?, title? }`
 *  - Demo: `demo://<id>` shorthand or `{ demo: '<id>', title? }` — surfaced
 *    in the activity-bar tree with a play icon; clicking does nothing in
 *    the IDE (the runtime is what fires demos), but the entry remains
 *    visible so the agenda is complete. */
function parseCoverItem(raw: unknown): CoverItemInfo | null {
  if (typeof raw === 'string') {
    if (!raw) return null
    if (raw.startsWith(DEMO_PREFIX)) {
      const demoId = raw.slice(DEMO_PREFIX.length)
      if (!demoId) return null
      return { kind: 'demo', demoId, title: null }
    }
    const parsed = parseTargetShorthand(raw)
    return {
      kind: 'file',
      file: parsed.file ?? raw,
      line: parsed.line ?? null,
      id: parsed.id ?? null,
      title: null,
    }
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.demo === 'string' && o.demo) {
    return {
      kind: 'demo',
      demoId: o.demo,
      title: typeof o.title === 'string' ? o.title : null,
    }
  }
  if (typeof o.file !== 'string' || !o.file) return null
  return {
    kind: 'file',
    file: o.file,
    line: typeof o.line === 'number' ? o.line : null,
    id: typeof o.id === 'string' ? o.id : null,
    title: typeof o.title === 'string' ? o.title : null,
  }
}

function parseOpen(raw: unknown): OpenTarget | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  if (typeof raw === 'string') {
    const parsed = parseTargetShorthand(raw)
    return {
      file: parsed.file ?? raw,
      line: parsed.line ?? null,
      id: parsed.id ?? null,
    }
  }
  if (typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  return {
    file: typeof o.file === 'string' ? o.file : null,
    line: typeof o.line === 'number' ? o.line : null,
    id: typeof o.id === 'string' ? o.id : null,
  }
}

/** Mirror of `parseTargetShorthand` in `src/project/schema.ts`. Peels
 *  `path[#id][@line]` suffixes from the right; either order works.
 *  `@N` requires N to be a positive integer, otherwise it stays in the
 *  path (so npm-scoped paths / non-numeric tags round-trip cleanly). */
function parseTargetShorthand(s: string): {
  file?: string
  id?: string
  line?: number
} {
  let path = s
  let id: string | undefined
  let line: number | undefined
  let changed = true
  while (changed) {
    changed = false
    const atIdx = path.lastIndexOf('@')
    if (atIdx > 0 && line === undefined) {
      const suffix = path.slice(atIdx + 1)
      if (/^\d+$/.test(suffix)) {
        const n = parseInt(suffix, 10)
        if (n > 0) {
          line = n
          path = path.slice(0, atIdx)
          changed = true
          continue
        }
      }
    }
    const hashIdx = path.lastIndexOf('#')
    if (hashIdx > 0 && id === undefined) {
      const suffix = path.slice(hashIdx + 1)
      if (suffix.length > 0) {
        id = suffix
        path = path.slice(0, hashIdx)
        changed = true
        continue
      }
    }
  }
  return { file: path.length > 0 ? path : undefined, id, line }
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
    const stage = project.stages.find((s) => s.id === screenId)
    if (!stage) return undefined
    if (stage.steps.length > 0) return stage.steps[0].resolvedOpen
    return stage.defaultOpen
  }
  const stageId = screenId.slice(0, dot)
  const stepId = screenId.slice(dot + 1)
  const stage = project.stages.find((s) => s.id === stageId)
  if (!stage) return undefined
  const step = stage.steps.find((s) => s.id === stepId)
  if (!step) return undefined
  return step.resolvedOpen
}

/** Convenience: every targetable target for completion — bare stage
 *  ids plus dotted stage.step ids. */
export function allScreenIds(project: Project): string[] {
  const out: string[] = []
  for (const s of project.stages) {
    out.push(s.id)
    for (const st of s.steps) out.push(`${s.id}.${st.id}`)
  }
  return out
}
