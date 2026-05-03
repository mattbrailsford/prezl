/**
 * Screen index + selector grammar used inside `@prezl` directives.
 *
 * A "screen" is the addressable unit the presenter advances through: either
 * a stage with no `steps:` (one implicit screen whose id is the bare stage
 * id) or one entry in a stage's `steps:` array (id = `stage.step`).
 *
 * Selector grammar:
 *
 *   [shell]                          -- every screen of the shell stage
 *   [shell.intro]                    -- one specific screen
 *   [shell, demo]                    -- explicit list (still per-screen)
 *   [shell.intro...shell.outro]      -- closed range, intra-stage
 *   [shell.intro...dashboard.outro]  -- closed range, crosses stages
 *   [shell.intro...]                 -- from this screen to end of deck
 *   [...dashboard.outro]             -- from start of deck through here
 *   [shell.intro...dashboard, demo]  -- mixed ranges + items
 *
 * Whitespace is insignificant. Unknown stage / step ids or inverted
 * ranges return structured errors callers can surface with file + line
 * context.
 */

import type { CoverItem, Demo, OpenTarget, Screen, Stage } from '@/types'

export type ScreenIndex = {
  /** id ("shell" or "shell.intro") -> resolved Screen */
  byId: Record<string, Screen>
  /** Flat ordered screen list — Space/PageDown walks this. */
  ordered: Screen[]
  /** stage id -> flat order bounds + member ids, used by the selector
   *  parser and TopBar step indicator. */
  byStage: Record<
    string,
    { first: number; last: number; screens: Screen[] }
  >
}

export type ScreenListResult =
  | { ok: true; ids: string[]; matches: (screenId: string) => boolean }
  | { ok: false; error: string }

/**
 * Build the flat screen index from a project's stages. Stages with no
 * `steps:` produce one implicit screen (id = stage.id, stepId = null);
 * stages with `steps:` produce one screen per step (id = `stage.step`).
 *
 * Resolution rules:
 *
 * Step `open` is tri-state with **runtime persistence** — there's no chain
 * inheritance across omitted steps. The runtime treats an undefined `open`
 * as "no opinion at this screen" so the reducer's prior-active-file rule
 * preserves whatever the presenter is doing — including respecting a
 * manually-closed file.
 *  - omitted (`undefined`) → step 1 seeds from `stage.open` (entering the
 *    stage is the author's "land here" intent); subsequent omitted steps
 *    resolve to `undefined` so nothing is forced open or closed
 *  - explicit `null` → reset to `stage.open` (which itself may be a value,
 *    `null`, or `undefined`)
 *  - a partial object (`{ id }` / `{ line }` with no `file`) → fill `file`
 *    from the most recent resolved open that had one. The latest-authored
 *    file is tracked separately from `screen.open`, so this still works
 *    across an omitted step in between
 *  - a full value → use as-is
 *
 * Step `demos` and `cover` resolve **stage→step only** (no step-to-step
 * chain). Each step independently inherits the stage's default unless it
 * declares its own. Reference identity is preserved across consecutive
 * inherited steps because they all resolve to the same stage list, which
 * is what the autoLaunch / visited-tracking logic keys off.
 *  - omitted (`undefined`) → use `stage.demos` / `stage.cover`
 *  - explicit `null` → explicitly empty (this step has nothing, even if
 *    the stage does); resolves to `undefined` at the screen level
 *  - a value → use as-is
 *
 * Step id collisions inside a stage throw — the schema layer should
 * have caught this; failing loud here keeps debugging simple.
 */
export function buildScreenIndex(stages: Stage[]): ScreenIndex {
  const ordered: Screen[] = []
  const byId: Record<string, Screen> = {}
  const byStage: ScreenIndex['byStage'] = {}

  const sorted = [...stages].sort((a, b) => a.order - b.order)
  let order = 0

  for (const stage of sorted) {
    const start = order
    const stageScreens: Screen[] = []
    if (!stage.steps || stage.steps.length === 0) {
      const screen: Screen = {
        id: stage.id,
        stageId: stage.id,
        stepId: null,
        order: order++,
        title: stage.title,
        open: stage.open,
        openIdentity: stage.open,
        demos: stage.demos,
        cover: stage.cover,
      }
      ordered.push(screen)
      byId[screen.id] = screen
      stageScreens.push(screen)
    } else {
      const seen = new Set<string>()
      // `prevOpenWithFile` tracks the most recent resolved open that has a
      // `file`, used purely as the source for partial-`{id}`/`{line}` step
      // inheritance. It does NOT chain into omitted steps' resolved opens
      // (those resolve to `undefined`), so an authored partial after an
      // omitted gap still inherits the right file.
      let prevOpenWithFile: OpenTarget | undefined =
        stage.open && stage.open.file ? stage.open : undefined
      let isFirstStep = true
      for (const step of stage.steps) {
        if (seen.has(step.id)) {
          throw new Error(
            `duplicate step id "${step.id}" in stage "${stage.id}"`,
          )
        }
        seen.add(step.id)
        // Tri-state for `open`:
        //   undefined → step 1 seeds from stage.open; subsequent steps get
        //               undefined ("no opinion"; reducer preserves runtime)
        //   null      → reset to stage.open
        //   partial   → fill `file` from prevOpenWithFile so an authored
        //               `{ id }` step still has a target file across an
        //               omitted gap
        //   value     → use as-is
        const open: OpenTarget | null | undefined =
          step.open === undefined
            ? isFirstStep
              ? stage.open
              : undefined
            : step.open === null
              ? stage.open
              : step.open.file === undefined && prevOpenWithFile?.file
                ? { ...step.open, file: prevOpenWithFile.file }
                : step.open
        // openIdentity is the stable per-frame reference for visited-link
        // invalidation. Always inherits stage.open when the step omits or
        // explicitly resets its open — including non-first steps, where
        // runtime `open` deliberately drops to `undefined` to preserve
        // presenter actions. Step-level authored opens (full or partial)
        // get the step's own object reference, so the markdown intro's
        // visited links re-prompt under the new framing.
        const openIdentity: OpenTarget | null | undefined =
          step.open === undefined
            ? stage.open
            : step.open === null
              ? stage.open
              : step.open
        // Stage→step resolution for demos/cover. No step-to-step chain:
        //   undefined → stage.demos / stage.cover (shared reference, so
        //               consecutive inheriting steps satisfy the ref-
        //               identity check that gates autoLaunch re-fires)
        //   null      → undefined (explicitly empty; the screen has none)
        //   value     → use as-is
        const demos =
          step.demos === undefined
            ? stage.demos
            : step.demos === null
              ? undefined
              : step.demos
        const cover: CoverItem[] | undefined =
          step.cover === undefined
            ? stage.cover
            : step.cover === null
              ? undefined
              : step.cover
        const screen: Screen = {
          id: `${stage.id}.${step.id}`,
          stageId: stage.id,
          stepId: step.id,
          order: order++,
          title: step.title,
          open,
          openIdentity,
          demos,
          cover,
        }
        ordered.push(screen)
        byId[screen.id] = screen
        stageScreens.push(screen)
        if (open && open.file) prevOpenWithFile = open
        isFirstStep = false
      }
    }
    byStage[stage.id] = {
      first: start,
      last: order - 1,
      screens: stageScreens,
    }
  }

  return { byId, ordered, byStage }
}

/** Walk every stage and step, collecting demos with an `id`. First-wins on
 *  duplicates — silent rather than throwing because the project is otherwise
 *  loadable; the second author of a duplicate id just doesn't get
 *  demo://-link triggering. Empty map when no demos declare an id, which is
 *  the common case before this feature gets adopted. */
export function buildDemoIndex(stages: Stage[]): Map<string, Demo> {
  const out = new Map<string, Demo>()
  const consider = (demos: Demo[] | null | undefined) => {
    if (!demos) return
    for (const d of demos) {
      if (d.id && !out.has(d.id)) out.set(d.id, d)
    }
  }
  for (const stage of stages) {
    consider(stage.demos)
    for (const step of stage.steps ?? []) consider(step.demos ?? undefined)
  }
  return out
}

/**
 * Parse a selector body (without the brackets) and return the expanded
 * screen-id set plus a matcher fn.
 *
 * `null` or empty input matches every screen. Bare-stage refs (`shell`)
 * expand to every screen of that stage. Bare-stage refs in a range
 * resolve to that stage's first screen on the LHS and last on the RHS,
 * so `[shell...dashboard]` Just Works regardless of whether either has
 * steps.
 */
export function parseScreenList(
  input: string | null | undefined,
  index: ScreenIndex,
): ScreenListResult {
  if (input == null || input.trim() === '') {
    return {
      ok: true,
      ids: index.ordered.map((s) => s.id),
      matches: () => true,
    }
  }

  const allowed = new Set<string>()
  const items = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const item of items) {
    const rangeParts = item.split('...')
    if (rangeParts.length === 1) {
      const expanded = expandSingleRef(rangeParts[0].trim(), index)
      if ('error' in expanded) return { ok: false, error: expanded.error }
      for (const id of expanded.ids) allowed.add(id)
      continue
    }
    if (rangeParts.length !== 2) {
      return { ok: false, error: `malformed range: ${item}` }
    }
    const [rawFrom, rawTo] = rangeParts
    const from = rawFrom.trim()
    const to = rawTo.trim()

    let fromOrder: number | null = null
    let toOrder: number | null = null
    if (from !== '') {
      const f = resolveRangeBound(from, 'from', index)
      if ('error' in f) return { ok: false, error: f.error }
      fromOrder = f.order
    }
    if (to !== '') {
      const t = resolveRangeBound(to, 'to', index)
      if ('error' in t) return { ok: false, error: t.error }
      toOrder = t.order
    }
    if (fromOrder != null && toOrder != null && fromOrder > toOrder) {
      return { ok: false, error: `inverted range: ${item}` }
    }
    for (const screen of index.ordered) {
      if (fromOrder != null && screen.order < fromOrder) continue
      if (toOrder != null && screen.order > toOrder) continue
      allowed.add(screen.id)
    }
  }

  return {
    ok: true,
    ids: [...allowed],
    matches: (id) => allowed.has(id),
  }
}

/** Expand a singleton ref (no `...`). Bare stage = every screen of stage. */
function expandSingleRef(
  ref: string,
  index: ScreenIndex,
): { ids: string[] } | { error: string } {
  if (ref.includes('.')) {
    if (!(ref in index.byId)) {
      return { error: unknownRefError(ref, index) }
    }
    return { ids: [ref] }
  }
  const stage = index.byStage[ref]
  if (!stage) {
    return { error: `unknown stage id: ${ref}` }
  }
  return { ids: stage.screens.map((s) => s.id) }
}

/** Resolve a single ref to a flat order index for use in a range bound. */
function resolveRangeBound(
  ref: string,
  side: 'from' | 'to',
  index: ScreenIndex,
): { order: number } | { error: string } {
  if (ref.includes('.')) {
    const screen = index.byId[ref]
    if (!screen) return { error: unknownRefError(ref, index) }
    return { order: screen.order }
  }
  const stage = index.byStage[ref]
  if (!stage) return { error: `unknown stage id: ${ref}` }
  return { order: side === 'from' ? stage.first : stage.last }
}

function unknownRefError(ref: string, index: ScreenIndex): string {
  // Distinguish "unknown stage" from "known stage, unknown step" so the
  // author's typo is easier to find.
  const dot = ref.indexOf('.')
  if (dot < 0) return `unknown stage id: ${ref}`
  const stage = ref.slice(0, dot)
  if (!(stage in index.byStage)) {
    return `unknown stage id: ${stage}`
  }
  return `unknown step id: ${ref}`
}
