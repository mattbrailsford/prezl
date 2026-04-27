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
 *  file on line 1") or the full object form. The string shorthand is the
 *  common case; the object form is only needed when the author wants to
 *  jump to a specific line / symbol id. */
const openTarget = z.union([
  z.string().min(1).transform((file) => ({ file, line: 1 })),
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
  open: openTarget.optional(),
  symbols: z.record(z.string(), symbolTarget).optional(),
  preview: preview.optional(),
  steps: z.array(screenStep).optional(),
})

export const prezlProjectSchema = z.object({
  name: z.string().min(1),
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
