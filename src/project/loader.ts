import { parse as parseYaml, YAMLParseError } from 'yaml'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { prezlProjectSchema, type LoadError } from './schema'
import type { Stage, PrezlProject } from '@/types'

type BackendProjectLoad = {
  root: string
  manifest: string
}

export type LoadedProject = {
  project: PrezlProject
  rawFiles: Map<string, string> // relPath -> contents
}

export async function pickProjectFolder(): Promise<string | null> {
  const result = await openDialog({ directory: true, multiple: false })
  if (!result) return null
  return typeof result === 'string' ? result : (result as unknown as { path: string }).path
}

export async function loadProjectFromDisk(
  path: string,
): Promise<{ project: PrezlProject; rawFiles: Map<string, string> } | { error: LoadError }> {
  let backend: BackendProjectLoad
  try {
    backend = await invoke<BackendProjectLoad>('load_project', { path })
  } catch (e) {
    return { error: translateBackendError(e) }
  }

  let raw: unknown
  try {
    raw = parseYaml(backend.manifest)
  } catch (e) {
    if (e instanceof YAMLParseError) {
      return {
        error: {
          kind: 'parse',
          message: e.message,
          line: e.linePos?.[0]?.line,
          column: e.linePos?.[0]?.col,
        },
      }
    }
    return {
      kind: 'parse',
      error: { kind: 'parse', message: (e as Error).message },
    } as { error: LoadError }
  }

  const parsed = prezlProjectSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: {
        kind: 'validation',
        message: 'prezl.yaml failed validation',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    }
  }

  let files: string[]
  try {
    files = await invoke<string[]>('list_project_files')
  } catch (e) {
    return { error: translateBackendError(e) }
  }

  const project: PrezlProject = {
    name: parsed.data.name,
    language: parsed.data.language,
    theme: parsed.data.theme,
    projects: parsed.data.projects,
    stages: parsed.data.stages.map<Stage>((s) => ({
      alias: s.alias,
      branch: s.branch,
      title: s.title,
      order: s.order,
      open: s.open,
      symbols: s.symbols,
      preview: s.preview,
    })),
    rootPath: backend.root,
    files,
  }

  const rawFiles = new Map<string, string>()
  for (const rel of files) {
    try {
      const contents = await invoke<string>('read_project_file', { relPath: rel })
      rawFiles.set(rel, contents)
    } catch (e) {
      return { error: translateBackendError(e, rel) }
    }
  }

  return { project, rawFiles }
}

function translateBackendError(raw: unknown, context?: string): LoadError {
  // Rust side returns { kind, message } via thiserror/serde.
  const err = raw as { kind?: string; message?: string } | string | undefined
  if (typeof err === 'string') return { kind: 'io', message: err }
  if (!err) return { kind: 'io', message: 'unknown error' }
  const prefix = context ? `${context}: ` : ''
  const kindMap: Record<string, LoadError['kind']> = {
    'missing-manifest': 'io',
    'no-active-project': 'io',
    'path-escape': 'io',
    'not-found': 'io',
    io: 'io',
  }
  return {
    kind: kindMap[err.kind ?? ''] ?? 'io',
    message: prefix + (err.message ?? err.kind ?? 'unknown'),
  }
}
