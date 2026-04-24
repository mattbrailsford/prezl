// Mirrors spec §10 data model with directive-system adjustments.
// See docs/prezl_product_spec.draft.md and the plan for rationale.

export type ProjectMeta = {
  name: string
  language?: string
  theme?: 'light' | 'dark'
}

export type ProjectFolder = {
  name: string
  path: string
  icon?: string
}

export type OpenTarget = {
  file: string
  line?: number
  id?: string
}

export type SymbolTarget = {
  file: string
  line?: number
  id?: string
}

export type UrlPreview = {
  type: 'url'
  src: string
  mode?: 'external' | 'window' | 'pane'
}

export type VideoCue = {
  time: number
  label?: string
}

export type VideoPreview = {
  type: 'video'
  src: string
  startAt?: number
  stopAt?: number
  cues?: VideoCue[]
}

export type Preview = UrlPreview | VideoPreview

export type Branch = {
  name: string
  alias: string
  title?: string
  order: number
  open?: OpenTarget
  symbols?: Record<string, SymbolTarget>
  preview?: Preview
}

export type PrezlProject = {
  project: ProjectMeta
  projects?: ProjectFolder[]
  branches: Branch[]
  rootPath?: string
  /** All files discovered under <root>/files, forward-slash relative paths. */
  files: string[]
}

export type PreviewState =
  | { kind: 'closed' }
  | { kind: 'launching'; preview: Preview }
  | { kind: 'video'; preview: VideoPreview }
  | { kind: 'url'; preview: UrlPreview }

export type Preferences = {
  uiScale: number
  explorerCollapsed: boolean
  explorerWidth: number
  autoRevealActiveFile: boolean
  explorerHintShown: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  uiScale: 1.0,
  explorerCollapsed: false,
  explorerWidth: 260,
  autoRevealActiveFile: true,
  explorerHintShown: false,
}

export const EXPLORER_MIN_WIDTH = 160
export const EXPLORER_MAX_WIDTH = 600
