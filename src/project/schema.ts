import { z } from 'zod'

const projectFolder = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  icon: z.string().optional(),
  /** Color family override. Any key in PROJECT_PALETTE (violet, sky,
   *  yellow, orange, emerald, cyan, red, indigo, pink, amber, slate).
   *  Falls back to the icon's default mapping, then to the generic
   *  --color-project-accent. */
  color: z.string().optional(),
})

/** `open` accepts either a bare file path string (shorthand for "open this
 *  file at the top, no specific line") or the full object form. The string
 *  shorthand is the common case; the object form is only needed when the
 *  author wants to jump to a specific line / symbol id.
 *
 *  Explicit `null` (`~` in YAML) means "no file open" — the editor pane is
 *  empty and only the file tree is visible. Useful for an intro screen
 *  that lets the audience take in the project structure before any code
 *  is shown. The reducer clears tabs when this resolves on a screen.
 *
 *  No implicit `line: 1` — the viewer's "no target" path is `scrollTop = 0`,
 *  which leaves default-collapsed folds collapsed. Setting `line: 1`
 *  explicitly would route through `scrollToLine`, which auto-expands any
 *  fold containing the target line — surprising for a file like one that
 *  opens with a `// @prezl collapse` block over its imports. */
const openTarget = z.union([
  z.string().min(1).transform((file) => ({ file })),
  z.object({
    file: z.string().min(1),
    line: z.number().int().positive().optional(),
    id: z.string().min(1).optional(),
  }),
])

const symbolTarget = z.object({
  file: z.string().min(1),
  line: z.number().int().positive().optional(),
  id: z.string().min(1).optional(),
})

const urlPreview = z.object({
  type: z.literal('url'),
  src: z.string().url().or(z.string().regex(/^\.{0,2}\//)),
  mode: z.enum(['external', 'window', 'pane']).optional(),
})

const videoCue = z.object({
  time: z.number().nonnegative(),
  label: z.string().optional(),
})

const videoPreview = z.object({
  type: z.literal('video'),
  src: z.string().min(1),
  startAt: z.number().nonnegative().optional(),
  stopAt: z.number().nonnegative().optional(),
  cues: z.array(videoCue).optional(),
  /** Open the video modal automatically at the start ("lead with video")
   *  or end ("trail with video") of the preview's *scope* — the run of
   *  screens sharing this preview reference, formed by sticky-forward
   *  inheritance across steps. `true` is shorthand for `'start'`; `false`
   *  and missing both mean no autolaunch.
   *
   *  - `'start'`: opens on the first screen of the scope (i.e., the
   *    screen where this preview newly appears).
   *  - `'end'`: opens on the last screen of the scope, when the
   *    presenter forward-advances out of it. The screen advance pauses,
   *    the video plays, and a subsequent carry-on close (atEnd Space,
   *    or natural video end) advances the deck in the same press.
   *
   *  Once an `'end'` video has fired for its scope it won't re-fire in
   *  the same session, even if the presenter walks back through. */
  autoLaunch: z
    .union([z.boolean(), z.literal('start'), z.literal('end')])
    .optional()
    .transform((v) => {
      if (v === true || v === 'start') return 'start' as const
      if (v === 'end') return 'end' as const
      return undefined
    }),
})

const preview = z.discriminatedUnion('type', [urlPreview, videoPreview])

/** `steps:` entries accept either a bare alias string (shorthand for a
 *  step with only an alias and no overrides) or the full object form when
 *  the author needs a title / open / preview override.
 *
 *  Both `open` and `preview` are tri-state: omit to keep sticky-forward
 *  inheritance from the previous step, give a value to override, or
 *  explicitly write `null` (`~` in YAML) to *reset* — fall back to the
 *  stage's default, ignoring any earlier step override. The reset form
 *  is what lets a step say "drop the trailing-video preview my sibling
 *  declared and revert to the stage's plain preview." */
const screenStep = z.union([
  z.string().min(1).transform((alias) => ({ alias })),
  z.object({
    alias: z.string().min(1),
    title: z.string().optional(),
    open: openTarget.nullable().optional(),
    preview: preview.nullable().optional(),
  }),
])

const stage = z.object({
  alias: z.string().min(1),
  branch: z.string().min(1).optional(),
  title: z.string().optional(),
  open: openTarget.nullable().optional(),
  symbols: z.record(z.string(), symbolTarget).optional(),
  preview: preview.optional(),
  steps: z.array(screenStep).optional(),
  /** When true, entering this stage from another stage clears workspace
   *  clutter that built up during the previous phase. Tabs collapse to
   *  just the resolved `open` file. The explorer is reset *monotonically
   *  toward less clutter*: folders the presenter expanded beyond the
   *  baseline are re-collapsed, but folders (and top-level groups) the
   *  presenter deliberately collapsed stay collapsed — a declutter act
   *  the reset honors rather than undoes. The active file's chain is the
   *  only forced-open exception, since the tab would otherwise point at
   *  hidden content. Cross-stage entry only; step transitions within the
   *  stage and back-nav don't trigger it. */
  reset: z.boolean().optional(),
})

export const prezlProjectSchema = z.object({
  name: z.string().min(1),
  /** Optional path (relative to the project root) to an image used in
   *  place of the Prezl pretzel mark in the top-left of the editor.
   *  Anything the webview can render in an `<img>` works — SVG, PNG,
   *  JPEG, WebP. Resolved through Tauri's asset protocol, so the file
   *  doesn't need to live under `files/`. */
  logo: z.string().min(1).optional(),
  projects: z.array(projectFolder).optional(),
  stages: z.array(stage).min(1),
})

export type PrezlProjectParsed = z.infer<typeof prezlProjectSchema>

export type LoadError = {
  kind: 'parse' | 'validation' | 'io'
  message: string
  issues?: { path: string; message: string }[]
  line?: number
  column?: number
}
