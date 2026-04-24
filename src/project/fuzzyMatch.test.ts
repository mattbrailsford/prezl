import { describe, expect, it } from 'vitest'
import { fuzzyFilter, fuzzyMatch } from './fuzzyMatch'

describe('fuzzyMatch', () => {
  it('returns 0 for empty query (matches everything)', () => {
    expect(fuzzyMatch('', 'anything')).toBe(0)
  })

  it('matches subsequences', () => {
    expect(fuzzyMatch('rd', 'registerDashboard')).not.toBeNull()
    expect(fuzzyMatch('regd', 'registerDashboard')).not.toBeNull()
  })

  it('returns null when the query is not a subsequence', () => {
    expect(fuzzyMatch('xyz', 'registerDashboard')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(fuzzyMatch('RD', 'registerDashboard')).not.toBeNull()
    expect(fuzzyMatch('rd', 'REGISTERDASHBOARD')).not.toBeNull()
  })

  it('scores tighter matches better (lower)', () => {
    const close = fuzzyMatch('dash', 'dashboard') // contiguous at start
    const loose = fuzzyMatch('dash', 'someDashish') // non-contiguous
    expect(close!).toBeLessThan(loose!)
  })
})

describe('fuzzyFilter', () => {
  it('returns the input list when the query is empty', () => {
    const items = ['a', 'b', 'c']
    expect(fuzzyFilter(items, (x) => x, '')).toEqual(items)
  })

  it('ranks close matches first', () => {
    const ids = ['registerDashboard', 'renderCharts', 'dashboardEntry']
    const out = fuzzyFilter(ids, (x) => x, 'dash')
    expect(out[0]).toBe('dashboardEntry')
  })

  it('drops non-matching entries', () => {
    const ids = ['foo', 'bar', 'baz']
    expect(fuzzyFilter(ids, (x) => x, 'z')).toEqual(['baz'])
  })
})
