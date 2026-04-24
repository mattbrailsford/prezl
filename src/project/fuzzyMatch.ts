/**
 * Tiny case-insensitive subsequence fuzzy matcher.
 *
 * Returns `null` when the query's characters aren't all present in order in
 * the candidate; otherwise a non-negative score where **lower is better**.
 *
 *   fuzzyMatch('regd', 'registerDashboard')  -> ~small number
 *   fuzzyMatch('xyz',  'registerDashboard')  -> null
 *
 * Scoring favours:
 *   - tighter matches (consecutive characters add 0 to score)
 *   - matches closer to the start of the candidate
 */
export function fuzzyMatch(query: string, candidate: string): number | null {
  if (query === '') return 0
  const q = query.toLowerCase()
  const c = candidate.toLowerCase()
  let ci = 0
  let score = 0
  let lastMatched = -1
  for (let i = 0; i < q.length; i++) {
    const ch = q[i]
    const found = c.indexOf(ch, ci)
    if (found < 0) return null
    if (lastMatched < 0) {
      // penalty proportional to where the first match starts
      score += found
    } else if (found !== lastMatched + 1) {
      // gap between consecutive matched characters
      score += (found - lastMatched) * 2
    }
    lastMatched = found
    ci = found + 1
  }
  // Small bonus for shorter candidates (tighter overall match).
  return score + candidate.length * 0.01
}

/**
 * Fuzzy-filter + score a list of strings. Returns matches sorted best-first.
 * Empty query returns every item unscored in the order it was given.
 */
export function fuzzyFilter<T>(
  items: T[],
  getText: (item: T) => string,
  query: string,
): T[] {
  if (query.trim() === '') return items
  const scored: { item: T; score: number }[] = []
  for (const item of items) {
    const score = fuzzyMatch(query, getText(item))
    if (score !== null) scored.push({ item, score })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.map((s) => s.item)
}
