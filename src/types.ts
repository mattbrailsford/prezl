// Runtime data model — see docs/reference/yaml-schema.md for the
// authoring-side shape and docs/internal/design-principles.md for
// the framing.

export type ProjectFolder = {
  name: string
  path: string
  icon?: string
  color?: string
}

/** `file` is optional in the object form: a partial `{ id }` or `{ line }`
 *  inherits the file from the previous resolved open (the resolver in
 *  `stageList.ts` does the merge for step entries). At least one of the
 *  three fields is always present — an all-empty open never reaches here. */
export type OpenTarget = {
  file?: string
  line?: number
  id?: string
}

export type SymbolTarget = {
  file: string
  line?: number
  id?: string
}

/** One entry in a stage/step's `cover:` list — a file the presenter wants to
 *  remember to discuss. `file` is the only required field. `id` (or `line`)
 *  optionally targets a specific anchor inside the file; click handlers route
 *  through the symbol table to scroll there. `label` overrides the display
 *  text in the cover list (otherwise the file's basename is shown). */
export type CoverItem = {
  file: string
  id?: string
  line?: number
  label?: string
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
  /** Open the video modal automatically at the start of a screen
   *  ("lead with video") or when the presenter forward-advances out of
   *  the screen ("trail with video"). Sticky-inherited subsequent steps
   *  don't re-trigger. The schema accepts a bare `true` as shorthand for
   *  `'start'` and normalises to this enum. See `store.ts` for the
   *  fire/suppress rules. */
  autoLaunch?: 'start' | 'end'
}

export type Preview = UrlPreview | VideoPreview

/** A "step" inside a stage — the unit a presenter advances through within
 *  what the audience perceives as a single slide. Steps don't appear in the
 *  stage dropdown; Space/PageDown walks them linearly.
 *
 *  `open` and `preview` are tri-state: undefined means "inherit
 *  sticky-forward from the previous step's resolved value", explicit `null`
 *  means "reset — fall back to the stage's default, ignoring any prior step
 *  override", and a value means "use this". The reset form lets a later
 *  step break out of an earlier step's override without restating the
 *  stage's default. */
export type Step = {
  alias: string
  title?: string
  open?: OpenTarget | null
  preview?: Preview | null
  /** Step-level override for the stage's cover list. `undefined` inherits
   *  sticky-forward from the previous step; explicit `null` resets to the
   *  stage's `cover` (or unset if the stage has none); a value replaces
   *  the inherited list outright. */
  cover?: CoverItem[] | null
}

export type Stage = {
  /** Canonical stage identifier — referenced by directives and the symbol
   *  table. Required. */
  alias: string
  /** Optional git branch name for display only ("feature/dashboard-shell").
   *  Stages don't actually map to git branches at runtime; this is just the
   *  human-readable label that travels with the stage. */
  branch?: string
  title?: string
  order: number
  /** `null` (YAML `~`) explicitly means "no file open" — the screen
   *  resolves with no active file and an empty tab strip. `undefined`
   *  preserves whatever was active on the prior screen. */
  open?: OpenTarget | null
  symbols?: Record<string, SymbolTarget>
  preview?: Preview
  /** Optional ordered list of intra-stage steps. A stage with no steps has
   *  one implicit screen whose id is the bare stage alias. */
  steps?: Step[]
  /** Files the presenter wants to remember to discuss while in this stage.
   *  Surfaced as a clickable list under the explorer, with a check mark when
   *  the file has been opened during the current stage's tenure. Sticky-
   *  inherited across step transitions like `open`/`preview`; not inherited
   *  across stage boundaries. */
  cover?: CoverItem[]
  /** When true, cross-stage entry into this stage clears every non-active
   *  tab and collapses every explorer folder outside the active file's
   *  ancestor chain. Step transitions within the stage and back-nav don't
   *  trigger it. */
  reset?: boolean
}

/** Flat addressable unit the presenter advances through. Either a stage
 *  with no steps (`id === stageAlias`, `stepAlias === null`) or one entry
 *  in a stage's `steps:` array (`id === "${stageAlias}.${stepAlias}"`). */
export type Screen = {
  id: string
  stageAlias: string
  stepAlias: string | null
  /** Flat 0-based index across the whole deck — defines navigation order
   *  and is what selector ranges resolve against. */
  order: number
  title?: string
  /** Resolved `open` after step→stage inheritance (and step-to-step
   *  carry-forward within a stage). Explicit `null` means "this screen
   *  has no file open" — the reducer clears tabs and leaves the editor
   *  pane empty. `undefined` is the implicit case (no authored intent;
   *  the reducer preserves whatever was active or falls back to the
   *  first visible file). */
  open?: OpenTarget | null
  preview?: Preview
  /** Resolved cover list after step→stage inheritance. Empty/unset on
   *  screens whose stage declared no `cover:` and whose steps didn't add
   *  one either. */
  cover?: CoverItem[]
}

export type PrezlProject = {
  name: string
  /** Optional path (relative to the project root) to an image that
   *  replaces the Prezl pretzel mark in the top-left of the editor. */
  logo?: string
  projects?: ProjectFolder[]
  stages: Stage[]
  rootPath?: string
  /** All files discovered under <root>/files, forward-slash relative paths. */
  files: string[]
}

export type PreviewState =
  | { kind: 'closed' }
  | { kind: 'launching'; preview: Preview }
  /** `trailing` is set when the modal was opened via `autoLaunch: 'end'` —
   *  the carry-on close path (atEnd + Space) advances the deck instead of
   *  just dismissing the modal. Esc / mid-play closes always stay put. */
  | { kind: 'video'; preview: VideoPreview; trailing?: boolean }
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
