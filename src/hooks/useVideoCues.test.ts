import { describe, expect, it } from 'vitest'
import { prepareCues, pruneConsumedAfterSeek, selectNextCue } from './useVideoCues'
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

describe('pruneConsumedAfterSeek', () => {
  const sorted = cues(2, 5, 10)

  it('consumes every cue behind the playhead even if none were consumed', () => {
    // Jumping forward across un-consumed cues (e.g. clicking a far marker)
    // must mark the skipped cues consumed so they don't fire and snap the
    // playhead backward to an earlier marker.
    expect(pruneConsumedAfterSeek(new Set(), sorted, 7)).toEqual(new Set([0, 1]))
  })

  it('keeps cues that are now behind the playhead', () => {
    const consumed = new Set([0, 1])
    expect(pruneConsumedAfterSeek(consumed, sorted, 7)).toEqual(new Set([0, 1]))
  })

  it('un-consumes cues that are now ahead of the playhead', () => {
    const consumed = new Set([0, 1, 2])
    expect(pruneConsumedAfterSeek(consumed, sorted, 4)).toEqual(new Set([0]))
  })

  it('un-consumes a cue we landed exactly on so it re-fires', () => {
    const consumed = new Set([0])
    expect(pruneConsumedAfterSeek(consumed, sorted, 2)).toEqual(new Set())
  })

  it('keeps a cue armed when the seek lands just past it (within tolerance)', () => {
    // Seeking to cue 1 (time 5) often settles a few ms past it. The cue must
    // stay armed so it still fires and pauses — a strict time<currentTime test
    // would consume it and the playhead would sail through.
    // cue 0 (time 2) is genuinely behind and consumed; cue 1 (time 5) is
    // within tolerance of the playhead so it stays armed.
    expect(pruneConsumedAfterSeek(new Set([1]), sorted, 5.1)).toEqual(new Set([0]))
    // Beyond tolerance cue 1 is genuinely behind and stays consumed too.
    expect(pruneConsumedAfterSeek(new Set([1]), sorted, 5.3)).toEqual(new Set([0, 1]))
  })
})
