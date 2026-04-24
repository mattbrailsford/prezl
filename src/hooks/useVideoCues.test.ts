import { describe, expect, it } from 'vitest'
import { prepareCues, selectNextCue } from './useVideoCues'
import type { VideoCue } from '@/types'

const cues = (...times: number[]): VideoCue[] => times.map((time) => ({ time }))

describe('prepareCues', () => {
  it('returns [] when cues is undefined or empty', () => {
    expect(prepareCues(undefined, 0)).toEqual([])
    expect(prepareCues([], 10)).toEqual([])
  })

  it('sorts cues ascending by time', () => {
    expect(prepareCues(cues(5, 1, 3), 0)).toEqual(cues(1, 3, 5))
  })

  it('drops cues that fire before startAt', () => {
    expect(prepareCues(cues(1, 3, 5), 2)).toEqual(cues(3, 5))
    expect(prepareCues(cues(1, 3, 5), 0)).toEqual(cues(1, 3, 5))
    expect(prepareCues(cues(1, 3, 5), undefined)).toEqual(cues(1, 3, 5))
  })
})

describe('selectNextCue', () => {
  const sorted = cues(2, 5, 10)

  it('returns null when no cue has been reached', () => {
    expect(selectNextCue(0.5, sorted, new Set())).toBeNull()
    expect(selectNextCue(1.9 - 0.2 - 0.01, sorted, new Set())).toBeNull()
  })

  it('returns the first unconsumed cue once tolerance is crossed', () => {
    expect(selectNextCue(2, sorted, new Set())).toBe(0)
    // tolerance lets us fire slightly early
    expect(selectNextCue(1.85, sorted, new Set())).toBe(0)
  })

  it('skips consumed cues and picks the next unconsumed', () => {
    expect(selectNextCue(5.2, sorted, new Set([0]))).toBe(1)
    expect(selectNextCue(5.2, sorted, new Set([0, 1]))).toBeNull()
  })

  it('does not refire the same cue twice at the same time', () => {
    const consumed = new Set<number>()
    const first = selectNextCue(2.1, sorted, consumed)
    expect(first).toBe(0)
    if (first !== null) consumed.add(first)
    expect(selectNextCue(2.2, sorted, consumed)).toBeNull()
  })

  it('respects a custom tolerance', () => {
    expect(selectNextCue(1.5, sorted, new Set(), 0.5)).toBe(0)
    expect(selectNextCue(1.5, sorted, new Set(), 0.1)).toBeNull()
  })
})
