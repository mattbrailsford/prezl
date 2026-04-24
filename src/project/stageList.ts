/**
 * Stage-list grammar used inside `@prezl:*` directives.
 *
 *   [shell]                        -- single stage
 *   [shell, preview, demo]         -- explicit list
 *   [shell...demo]                 -- closed range by branch order (inclusive)
 *   [shell...]                     -- shell onwards
 *   [...demo]                      -- through demo
 *   [shell...preview, demo]        -- mixed ranges + explicit items
 *
 * Whitespace is insignificant. Aliases (not branch names) are referenced;
 * unknown aliases or inverted ranges produce structured errors callers can
 * surface with file + line context.
 */

export type StageIndex = Record<string, number>

export type StageListResult =
  | { ok: true; aliases: string[]; matches: (stageAlias: string) => boolean }
  | { ok: false; error: string }

/** Build a name -> order index from a list of branches. */
export function buildStageIndex(
  branches: { alias: string; order: number }[],
): StageIndex {
  const index: StageIndex = {}
  for (const b of branches) index[b.alias] = b.order
  return index
}

/**
 * Parse the contents of the square brackets (without the brackets themselves).
 * Returns the expanded alias set and a matcher fn.
 *
 * If you pass `null`/empty input, the result matches every stage (this is the
 * convenience form for `@prezl:collapse` with no stage list — "always").
 */
export function parseStageList(
  input: string | null | undefined,
  index: StageIndex,
): StageListResult {
  if (input == null || input.trim() === '') {
    return {
      ok: true,
      aliases: Object.keys(index),
      matches: () => true,
    }
  }

  const allowed = new Set<string>()
  const items = splitTopLevel(input.trim()).map((s) => s.trim()).filter(Boolean)

  for (const item of items) {
    const rangeParts = item.split('...')
    if (rangeParts.length === 1) {
      const alias = rangeParts[0].trim()
      if (!(alias in index)) {
        return { ok: false, error: `unknown stage alias: ${alias}` }
      }
      allowed.add(alias)
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
      if (!(from in index)) {
        return { ok: false, error: `unknown stage alias: ${from}` }
      }
      fromOrder = index[from]
    }
    if (to !== '') {
      if (!(to in index)) {
        return { ok: false, error: `unknown stage alias: ${to}` }
      }
      toOrder = index[to]
    }
    if (fromOrder != null && toOrder != null && fromOrder > toOrder) {
      return { ok: false, error: `inverted range: ${item}` }
    }
    for (const [alias, order] of Object.entries(index)) {
      if (fromOrder != null && order < fromOrder) continue
      if (toOrder != null && order > toOrder) continue
      allowed.add(alias)
    }
  }

  return {
    ok: true,
    aliases: [...allowed],
    matches: (stage) => allowed.has(stage),
  }
}

/** Split a comma-separated list at the top level. Ranges `a...b` stay intact. */
function splitTopLevel(input: string): string[] {
  // No nested brackets in this grammar, so a plain split on ',' is fine.
  return input.split(',')
}
