import { z } from 'zod'
import type { Demo } from '@/types'

/** Strip leading `./` and `/` so author-text paths line up with the bare
 *  forward-slash relpaths the Rust walker emits as `rawFiles` map keys.
 *
 *  Two common authoring habits we want to accept without the runtime
 *  silently failing to resolve:
 *
 *  - `./src/api.ts` — TypeScript / markdown muscle memory ("relative to
 *    here"). The project root *is* "here" for prezl.yaml, so the leading
 *    `./` is redundant. Strip any number so `././foo` collapses too.
 *  - `/src/api.ts` — read as "from project root", which is the implicit
 *    base. Strip a single leading slash; protocol-relative `//host/...`
 *    URLs are deliberately left alone (they're not file paths anyway, but
 *    being defensive costs nothing).
 *
 *  Interior `./` and `..` segments are left to the path-escape guard in
 *  `joined_within_root` (Rust); they would only ever come from a
 *  hand-written path the author probably wants to know about. */
export function normaliseProjectPath(s: string): string {
  let out = s
  while (out.startsWith('./')) out = out.slice(2)
  if (out.startsWith('/') && !out.startsWith('//')) out = out.slice(1)
  return out
}

const projectFolder = z.object({
  name: z.string().min(1),
  path: z.string().min(1).transform(normaliseProjectPath),
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
 *  After the `@` / `#` peel, the remaining file portion is run through
 *  `normaliseProjectPath` so leading `./` and `/` collapse to bare
 *  project-relative paths — that's how the rest of the runtime keys things.
 *
 *  Examples:
 *    "src/api.ts"                     → { file: "src/api.ts" }
 *    "src/api.ts#fetchData"           → { file, id: "fetchData" }
 *    "src/api.ts@42"                  → { file, line: 42 }
 *    "src/api.ts#fetchData@42"        → { file, id, line }
 *    "./src/api.ts"                   → { file: "src/api.ts" }
 *    "/src/api.ts"                    → { file: "src/api.ts" }
 *    "node_modules/@types/foo.ts"     → { file: full path } (no peel)
 *    "src/api.ts@notanumber"          → { file: full path } (no peel) */
export function parseTargetShorthand(s: string): {
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
  if (path.length === 0) return { file: undefined, id, line }
  const normalised = normaliseProjectPath(path)
  return {
    file: normalised.length > 0 ? normalised : undefined,
    id,
    line,
  }
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
      file: z
        .string()
        .min(1)
        .transform(normaliseProjectPath)
        .optional(),
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

const DEMO_PREFIX = 'demo://'

/** `cover` items are presenter reminders. Two shapes:
 *
 *  - **File**: a path string, optionally suffixed with `#anchorId` and/or
 *    `@line` (mirrors `open` shorthand). Object form: `{ file, id?, line?,
 *    title? }`.
 *  - **Demo**: a `demo://<id>` string referencing a project-wide demo `id:`.
 *    Object form: `{ demo: '<id>', title? }`. Click runs the demo, same as
 *    markdown's `[label](demo://<id>)` link. Mirrors that link grammar so an
 *    intro markdown's link list and a stage's cover list can mention the
 *    same demo by the same id.
 *
 *  The discriminator is added at parse time (`kind: 'file' | 'demo'`) so
 *  downstream code can switch on shape without pattern-matching strings.
 *  Falling back to the literal path on a malformed shorthand suffix keeps
 *  authoring round-tripping rather than blowing up the load on a stray
 *  separator in a filename. */
const coverItem = z.union([
  z
    .string()
    .min(1)
    .transform((s) => {
      if (s.startsWith(DEMO_PREFIX)) {
        const demoId = s.slice(DEMO_PREFIX.length)
        return { kind: 'demo' as const, demoId }
      }
      const parsed = parseTargetShorthand(s)
      const file = parsed.file ?? normaliseProjectPath(s)
      return { kind: 'file' as const, file, id: parsed.id, line: parsed.line }
    })
    .refine(
      (v) => v.kind !== 'demo' || v.demoId.length > 0,
      { message: 'demo:// cover shorthand must include an id' },
    ),
  z
    .object({
      demo: z.string().min(1),
      title: z.string().min(1).optional(),
    })
    .transform((o) => ({
      kind: 'demo' as const,
      demoId: o.demo,
      title: o.title,
    })),
  z
    .object({
      file: z.string().min(1).transform(normaliseProjectPath),
      line: z.number().int().positive().optional(),
      id: z.string().min(1).optional(),
      title: z.string().min(1).optional(),
    })
    .transform((o) => ({ kind: 'file' as const, ...o })),
])

/** Cover lists accept either a single item (string shorthand or object
 *  form, parallel to demo's single-object shorthand) or an explicit
 *  array. Both normalise to `CoverItem[]`. */
const cover = z.union([
  coverItem.transform((item) => [item]),
  z.array(coverItem),
])

const urlDemo = z.object({
  type: z.literal('url'),
  /** Optional human label, surfaced as the row label in the Run picker
   *  when the screen has more than one demo. Falls back to the URL. */
  title: z.string().min(1).optional(),
  /** Optional project-wide identifier. Lets a markdown intro reference
   *  the demo by `[label](demo://this-id)` — clicking the link runs the
   *  demo regardless of which screen the link sits on. Duplicates within
   *  one project resolve first-wins. */
  id: z.string().min(1).optional(),
  src: z.string().url().or(z.string().regex(/^\.{0,2}\//)),
  mode: z.enum(['external', 'window', 'pane']).optional(),
})

/** A cue is either a bare number (seconds shorthand) or the full
 *  `{ time, title? }` object. Both normalise to the object form. */
const videoCue = z.union([
  z.number().nonnegative().transform((time) => ({ time })),
  z.object({
    time: z.number().nonnegative(),
    title: z.string().optional(),
  }),
])

const videoDemo = z.object({
  type: z.literal('video'),
  /** Optional human label, surfaced as the row label in the Run picker
   *  when the screen has more than one demo. Falls back to the file
   *  basename. */
  title: z.string().min(1).optional(),
  /** Optional project-wide identifier. Lets a markdown intro reference
   *  the demo by `[label](demo://this-id)` — clicking the link runs the
   *  demo regardless of which screen the link sits on. Duplicates within
   *  one project resolve first-wins. */
  id: z.string().min(1).optional(),
  src: z.string().min(1),
  startAt: z.number().nonnegative().optional(),
  stopAt: z.number().nonnegative().optional(),
  cues: z.array(videoCue).optional(),
  /** Open the video modal automatically at the start ("lead with video")
   *  or end ("trail with video") of the demo's *scope* — the run of
   *  screens sharing this demo reference, formed by sticky-forward
   *  inheritance across steps. `true` is shorthand for `'start'`; `false`
   *  and missing both mean no autolaunch.
   *
   *  - `'start'`: opens on the first screen of the scope (i.e., the
   *    screen where this demo newly appears).
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

const demoItem = z.discriminatedUnion('type', [urlDemo, videoDemo])

/** Plural form: an authored array of demo entries. The autoLaunch
 *  invariant — ≤1 entry with `'start'` and ≤1 with `'end'` — is enforced
 *  here so the error points at the offending list, not somewhere
 *  downstream. */
const demoArray = z
  .array(demoItem)
  .superRefine((items, ctx) => {
    const startCount = items.filter(
      (i) => i.type === 'video' && i.autoLaunch === 'start',
    ).length
    if (startCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at most one demo can have autoLaunch: start',
      })
    }
    const endCount = items.filter(
      (i) => i.type === 'video' && i.autoLaunch === 'end',
    ).length
    if (endCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at most one demo can have autoLaunch: end',
      })
    }
  })

/** Field-shape mixin: returns the two YAML keys (`demo:` singular
 *  shorthand, `demos:` list) so they can be spread into a stage/step
 *  schema. Steps allow `null` (explicitly empty for this step); stages
 *  don't (omitting is the only "no demo" path at stage level). */
function demoFields(options: { allowNull: boolean }) {
  return {
    demo: options.allowNull
      ? demoItem.nullable().optional()
      : demoItem.optional(),
    demos: options.allowNull
      ? demoArray.nullable().optional()
      : demoArray.optional(),
  }
}

/** Adds the "use either `demo:` or `demos:`, not both" check to a
 *  stage/step schema. The actual merge into a single `demos` field
 *  happens in the loader so the parsed shape stays plain Zod-inferred. */
function preventBothDemoFields<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
) {
  return schema.superRefine((obj, ctx) => {
    const o = obj as { demo?: unknown; demos?: unknown }
    if (o.demo !== undefined && o.demos !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'use either `demo:` (single) or `demos:` (list), not both',
        path: ['demos'],
      })
    }
  })
}

/** Resolve the dual `demo:` (single) / `demos:` (list) fields on a
 *  parsed stage or step into a single normalised `Demo[] | null |
 *  undefined`. The schema's superRefine has already rejected the case
 *  where both are set, so this is a straight precedence check. */
export function resolveDemoField(parsed: {
  demo?: Demo | null
  demos?: Demo[] | null
}): Demo[] | null | undefined {
  if (parsed.demo !== undefined) {
    return parsed.demo === null ? null : [parsed.demo]
  }
  return parsed.demos
}

/** `steps:` entries accept either a bare id string (shorthand for a
 *  step with only an id and no overrides) or the full object form.
 *
 *  Resolution for `demos` and `cover` is stage→step only (no step-to-
 *  step chain). Omit to use the stage's default, give a value to override
 *  for this step, or write `null` (`~` in YAML) to explicitly clear (this
 *  step has nothing even though the stage does). Each step is independent;
 *  declaring on step 2 doesn't carry into step 3.
 *
 *  `open` is different: it's tri-state with runtime persistence — see the
 *  resolver in `stageList.ts` for the rules. */
const screenStep = z.union([
  z.string().min(1).transform((id) => ({ id })),
  preventBothDemoFields(
    z.object({
      id: z.string().min(1),
      title: z.string().optional(),
      open: openTarget.nullable().optional(),
      cover: cover.nullable().optional(),
      ...demoFields({ allowNull: true }),
    }),
  ),
])

const stage = preventBothDemoFields(
  z.object({
    id: z.string().min(1),
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
    ...demoFields({ allowNull: false }),
  }),
)

export const prezlProjectSchema = z.object({
  name: z.string().min(1),
  /** Optional path (relative to the project root) to an image used in
   *  place of the Prezl pretzel mark in the top-left of the editor.
   *  Anything the webview can render in an `<img>` works — SVG, PNG,
   *  JPEG, WebP. Resolved through Tauri's asset protocol. */
  logo: z.string().min(1).transform(normaliseProjectPath).optional(),
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
