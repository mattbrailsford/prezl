import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { VideoCue } from '@/types'

const DEFAULT_TOLERANCE_SECONDS = 0.2

export type VideoCueEvent = { cue: VideoCue; index: number }

/**
 * Pick the next cue that should fire at the given time, given the ones that
 * have already been consumed this session. Pure — unit-tested in
 * `useVideoCues.test.ts`.
 */
export function selectNextCue(
  currentTime: number,
  sortedCues: VideoCue[],
  consumed: Set<number>,
  tolerance: number = DEFAULT_TOLERANCE_SECONDS,
): number | null {
  for (let i = 0; i < sortedCues.length; i++) {
    if (consumed.has(i)) continue
    if (currentTime + tolerance >= sortedCues[i].time) return i
  }
  return null
}

/**
 * Filter + sort cues into the canonical order used by the runtime.
 * Cues earlier than `startAt` are dropped (they'd never fire anyway).
 */
export function prepareCues(
  cues: VideoCue[] | undefined,
  startAt: number | undefined,
): VideoCue[] {
  if (!cues || cues.length === 0) return []
  const start = startAt ?? 0
  return cues
    .filter((c) => c.time >= start)
    .slice()
    .sort((a, b) => a.time - b.time)
}

type UseVideoCuesArgs = {
  videoRef: RefObject<HTMLVideoElement | null>
  cues: VideoCue[] | undefined
  startAt: number | undefined
  stopAt: number | undefined
  onCueReached: (event: VideoCueEvent) => void
  onStopAt: () => void
}

/**
 * Drives cue + stopAt behaviour off the video element's `timeupdate` event.
 * The consumed set resets whenever the cues list or stopAt changes (i.e.
 * every fresh preview launch), so re-entering the same video starts clean.
 */
export function useVideoCues({
  videoRef,
  cues,
  startAt,
  stopAt,
  onCueReached,
  onStopAt,
}: UseVideoCuesArgs): void {
  const sortedCues = useMemo(() => prepareCues(cues, startAt), [cues, startAt])
  const consumedRef = useRef<Set<number>>(new Set())
  const stopFiredRef = useRef(false)

  // Reset consumed state for a new session.
  useEffect(() => {
    consumedRef.current = new Set()
    stopFiredRef.current = false
  }, [sortedCues, stopAt])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => {
      const t = video.currentTime

      if (
        stopAt !== undefined &&
        !stopFiredRef.current &&
        t >= stopAt
      ) {
        stopFiredRef.current = true
        onStopAt()
        return
      }

      const idx = selectNextCue(t, sortedCues, consumedRef.current)
      if (idx !== null) {
        consumedRef.current.add(idx)
        onCueReached({ cue: sortedCues[idx], index: idx })
      }
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [sortedCues, stopAt, videoRef, onCueReached, onStopAt])
}
