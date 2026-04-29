import { z } from 'zod'
import type { Preview } from '@/types'

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

/** Shorthand parser for `path[#id][@line]` strings. The suffixes peel from
 *  the right and may appear in either order; both leading-position cases
 *  (`#foo` / `@foo` with no path) are left intact in `file` so an author's
 *  weird filename keeps round-tripping rather than vanishing.
 *
 *  Examples:
 *    "src/api.ts"                     → { file: "src/api.ts" }
 *    "src/api.ts#fetchData"           → { file, id: "fetchData" }
 *    "src/api.ts@42"                  → { file, line: 42 }
 *    "src/api.ts#fetchData@42"        → { file, id, line }
 *    "node_modules/@types/foo.ts"     → { file: full path } (no peel)
 *    "src/api.ts@notanumber"          → { file: full path } (no peel) */
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

/** `open` accepts either a string shorthand or the full object form.
 *  String shorthand: `"path"`, `"path#id"`, `"path@line"`, or
 *  `"path#id@line"` (suffixes optional, either order, both can combine).
 *  Object form: `{ file?, line?, id? }` with at least one field — use it
 *  when a path is awkward to encode (e.g. characters that collide with
 *  the `#` / `@` separators) or to write a partial `{ id }` that inherits
 *  the file from the previous resolved open via the resolver in
 *  `stageList.ts`.
 *
 *  Explicit `null` (`~` in YAML) means "no file open" — the editor pane is
 *  empty and only the file tree is visible. Useful for an intro screen
 *  that lets the audience take in the project structure before any code
 *  is shown. The reducer clears tabs when this resolves on a screen.
 *
 *  No implicit `line: 1` — the viewer's "no target" path is `scrollTop = 0`,
 *  which leaves default-collapsed folds collapsed. Setting `line: 1`
 *  explicitly would route through `scrollToLine`, which auto-expands any
 *  fold containing the target line — surprising for a file that opens
 *  with a `// @prezl collapse` block over its imports. */
const openTarget = z.union([
  z
    .string()
    .min(1)
    .transform(parseTargetShorthand)
    .refine(
      (v) => v.file != null || v.line != null || v.id != null,
      { message: 'open shorthand must include a file, #id, or @line' },
    ),
  z
    .object({
      file: z.string().min(1).optional(),
      line: z.number().int().positive().optional(),
      id: z.string().min(1).optional(),
    })
    .refine(
      (v) => v.file != null || v.line != null || v.id != null,
      { message: 'open must specify at least one of file, line, or id' },
    ),
])

const symbolTarget = z.object({
  file: z.string().min(1),
  line: z.number().int().positive().optional(),
  id: z.string().min(1).optional(),
})

/** `cover` items are presenter reminders — files (and optional anchors) to
 *  discuss during a stage. Authoring shorthand mirrors `open`: a path
 *  string, optionally suffixed with `#anchorId` (jump to symbol) and/or
 *  `@line` (jump to line). The object form adds `label` for a custom row
 *  display. */
const coverItem = z.union([
  z
    .string()
    .min(1)
    .transform((s) => {
      const parsed = parseTargetShorthand(s)
      // Cover items must always have a file — falling back to the full
      // string when the parser couldn't extract one keeps malformed input
      // round-tripping rather than blowing up the whole load on a stray
      // separator in a path.
      const file = parsed.file ?? s
      return { file, id: parsed.id, line: parsed.line }
    }),
  z.object({
    file: z.string().min(1),
    line: z.number().int().positive().optional(),
    id: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
  }),
])

const cover = z.array(coverItem)

const urlPreview = z.object({
  type: z.literal('url'),
  /** Optional human label, surfaced as the row label in the Run picker
   *  when the screen has more than one preview. Falls back to the URL. */
  title: z.string().min(1).optional(),
  src: z.string().url().or(z.string().regex(/^\.{0,2}\//)),
  mode: z.enum(['external', 'window', 'pane']).optional(),
})

const videoCue = z.object({
  time: z.number().nonnegative(),
  label: z.string().optional(),
})

const videoPreview = z.object({
  type: z.literal('video'),
  /** Optional human label, surfaced as the row label in the Run picker
   *  when the screen has more than one preview. Falls back to the file
   *  basename. */
  title: z.string().min(1).optional(),
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

const previewItem = z.discriminatedUnion('type', [urlPreview, videoPreview])

/** Plural form: an authored array of preview entries. The autoLaunch
 *  invariant — ≤1 entry with `'start'` and ≤1 with `'end'` — is enforced
 *  here so the error points at the offending list, not somewhere
 *  downstream. */
const previewArray = z
  .array(previewItem)
  .superRefine((items, ctx) => {
    const startCount = items.filter(
      (i) => i.type === 'video' && i.autoLaunch === 'start',
    ).length
    if (startCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at most one preview can have autoLaunch: start',
      })
    }
    const endCount = items.filter(
      (i) => i.type === 'video' && i.autoLaunch === 'end',
    ).length
    if (endCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at most one preview can have autoLaunch: end',
      })
    }
  })

/** Field-shape mixin: returns the two YAML keys (`preview:` singular
 *  shorthand, `previews:` list) so they can be spread into a stage/step
 *  schema. Steps allow `null` (explicitly empty for this step); stages
 *  don't (omitting is the only "no preview" path at stage level). */
function previewFields(options: { allowNull: boolean }) {
  return {
    preview: options.allowNull
      ? previewItem.nullable().optional()
      : previewItem.optional(),
    previews: options.allowNull
      ? previewArray.nullable().optional()
      : previewArray.optional(),
  }
}

/** Adds the "use either `preview:` or `previews:`, not both" check to a
 *  stage/step schema. The actual merge into a single `previews` field
 *  happens in the loader so the parsed shape stays plain Zod-inferred. */
function preventBothPreviewFields<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
) {
  return schema.superRefine((obj, ctx) => {
    const o = obj as { preview?: unknown; previews?: unknown }
    if (o.preview !== undefined && o.previews !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'use either `preview:` (single) or `previews:` (list), not both',
        path: ['previews'],
      })
    }
  })
}

/** Resolve the dual `preview:` (single) / `previews:` (list) fields on a
 *  parsed stage or step into a single normalised `Preview[] | null |
 *  undefined`. The schema's superRefine has already rejected the case
 *  where both are set, so this is a straight precedence check. */
export function resolvePreviewField(parsed: {
  preview?: Preview | null
  previews?: Preview[] | null
}): Preview[] | null | undefined {
  if (parsed.preview !== undefined) {
    return parsed.preview === null ? null : [parsed.preview]
  }
  return parsed.previews
}

/** `steps:` entries accept either a bare alias string (shorthand for a
 *  step with only an alias and no overrides) or the full object form.
 *
 *  Resolution for `previews` and `cover` is stage→step only (no step-to-
 *  step chain). Omit to use the stage's default, give a value to override
 *  for this step, or write `null` (`~` in YAML) to explicitly clear (this
 *  step has nothing even though the stage does). Each step is independent;
 *  declaring on step 2 doesn't carry into step 3.
 *
 *  `open` is different: it's tri-state with runtime persistence — see the
 *  resolver in `stageList.ts` for the rules. */
const screenStep = z.union([
  z.string().min(1).transform((alias) => ({ alias })),
  preventBothPreviewFields(
    z.object({
      alias: z.string().min(1),
      title: z.string().optional(),
      open: openTarget.nullable().optional(),
      cover: cover.nullable().optional(),
      ...previewFields({ allowNull: true }),
    }),
  ),
])

const stage = preventBothPreviewFields(
  z.object({
    alias: z.string().min(1),
    branch: z.string().min(1).optional(),
    title: z.string().optional(),
    open: openTarget.nullable().optional(),
    symbols: z.record(z.string(), symbolTarget).optional(),
    steps: z.array(screenStep).optional(),
    /** Stage-level "agenda" — files the presenter should remember to cover.
     *  Inherited by steps that omit their own `cover:`. Not propagated
     *  across stage boundaries. */
    cover: cover.optional(),
    /** When true, entering this stage from another stage clears workspace
     *  clutter that built up during the previous phase. Tabs collapse to
     *  just the resolved `open` file. The explorer is reset *monotonically
     *  toward less clutter*: folders the presenter expanded beyond the
     *  baseline are re-collapsed, but folders the presenter deliberately
     *  collapsed stay collapsed — a declutter act the reset honors rather
     *  than undoes. The active file's chain is the only forced-open
     *  exception, since the tab would otherwise point at hidden content.
     *  Cross-stage entry only; step transitions within the stage and
     *  back-nav don't trigger it. */
    reset: z.boolean().optional(),
    ...previewFields({ allowNull: false }),
  }),
)

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
