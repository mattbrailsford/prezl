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

/**
 * Recompute the consumed set after a seek: a cue is consumed only if it sits
 * more than `tolerance` behind the new playhead; everything within tolerance
 * or ahead stays armed. This is a full recompute, not a prune — a seek can
 * jump across several cues at once (e.g. clicking a far marker, or a big
 * scrub), and cues that were jumped *over* must be marked consumed so they
 * don't fire and snap the playhead backward. Pruning the prior set alone
 * wasn't enough: a cue the playhead skipped past without ever consuming
 * stayed armed, and the next `timeupdate` fired it, yanking the playhead back
 * to that intermediate marker.
 *
 * The `tolerance` matters: a seek to a cue's exact time rarely lands exactly
 * on it (seek precision is coarse), so the playhead often settles a few ms
 * *past* the cue. A strict `time < currentTime` test would mark that just-
 * clicked cue consumed and it would never fire — the playhead sails past and
 * playback continues. Mirroring `selectNextCue`'s tolerance keeps a cue we
 * landed on (or just past, within tolerance) armed so it fires and pauses.
 */
export function pruneConsumedAfterSeek(
  _consumed: Set<number>,
  sortedCues: VideoCue[],
  currentTime: number,
  tolerance: number = DEFAULT_TOLERANCE_SECONDS,
): Set<number> {
  const next = new Set<number>()
  sortedCues.forEach((cue, idx) => {
    if (cue.time < currentTime - tolerance) next.add(idx)
  })
  return next
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
 * every fresh demo launch), so re-entering the same video starts clean.
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
  // Set right before the programmatic snap-to-cue seek so the resulting
  // `seeked` doesn't prune (re-arm) the cue we just consumed.
  const snappingRef = useRef(false)
  // Last playhead time we observed on a `timeupdate`. Used to spot a
  // discontinuous jump (a clicked marker / scrub) so cue selection can
  // resync the consumed set before firing — see the jump guard in
  // `onTimeUpdate`. `null` until the first tick.
  const lastTimeRef = useRef<number | null>(null)

  // Reset consumed state for a new session.
  useEffect(() => {
    consumedRef.current = new Set()
    stopFiredRef.current = false
    snappingRef.current = false
    lastTimeRef.current = null
  }, [sortedCues, stopAt])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => {
      const t = video.currentTime
      const last = lastTimeRef.current
      lastTimeRef.current = t

      // Resync the consumed set on a discontinuous jump. A seek (clicking a
      // marker, a big scrub) can cross several cues at once, and per the HTML
      // spec the seek algorithm runs "time marches on" — which fires this
      // `timeupdate` — *before* it queues the `seeked` task. So `onSeeked`'s
      // resync may land too late: without this guard the earliest cue we
      // jumped *over* is still armed, `selectNextCue` returns it, and the
      // snap-to-cue yanks the playhead backward to that intermediate marker.
      // A forward gap larger than a normal playback tick (~0.25s at 1×) or any
      // backward move means we seeked, not played.
      const SEEK_JUMP_SECONDS = 0.5
      if (last !== null && (t < last - 0.01 || t > last + SEEK_JUMP_SECONDS)) {
        consumedRef.current = pruneConsumedAfterSeek(
          consumedRef.current,
          sortedCues,
          t,
        )
      }

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
        // Snap the playhead exactly onto the cue time. The tolerance and the
        // coarse `timeupdate` cadence otherwise leave currentTime a fraction
        // off the cue, so the scrub-bar head sits beside the marker instead
        // of inside it. The `snappingRef` flag stops the `seeked` below from
        // re-arming the cue we just fired.
        const cueTime = sortedCues[idx].time
        if (Math.abs(video.currentTime - cueTime) > 0.001) {
          snappingRef.current = true
          video.currentTime = cueTime
        }
      }
    }

    // Scrubbing back across a cue (or below stopAt) should re-arm it. The
    // browser fires `seeked` after every completed seek — including the
    // many small seeks emitted while dragging the scrub bar — so this
    // hooks naturally into both presenter scrubbing and any programmatic
    // time changes.
    const onSeeked = () => {
      // The programmatic snap-to-cue seek isn't a presenter scrub — leave the
      // just-consumed cue armed-off so it doesn't immediately re-fire on
      // resume.
      if (snappingRef.current) {
        snappingRef.current = false
        return
      }
      const t = video.currentTime
      consumedRef.current = pruneConsumedAfterSeek(
        consumedRef.current,
        sortedCues,
        t,
      )
      if (stopAt !== undefined && t < stopAt) {
        stopFiredRef.current = false
      }
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('seeked', onSeeked)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('seeked', onSeeked)
    }
  }, [sortedCues, stopAt, videoRef, onCueReached, onStopAt])
}
