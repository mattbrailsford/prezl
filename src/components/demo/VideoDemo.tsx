import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { useVideoCues, type VideoCueEvent } from '@/hooks/useVideoCues'
import { convertProjectFileSrc } from '@/project/assetSrc'

export function VideoDemo() {
  const demo = useAppStore((s) =>
    s.demoState.kind === 'video' ? s.demoState.demo : null,
  )
  const trailing = useAppStore((s) =>
    s.demoState.kind === 'video' ? Boolean(s.demoState.trailing) : false,
  )
  const rootPath = useAppStore((s) => s.project?.rootPath ?? null)
  const closeDemo = useAppStore((s) => s.closeDemo)
  const switchScreenRelative = useAppStore((s) => s.switchScreenRelative)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [awaitingResume, setAwaitingResume] = useState(false)
  // Set when the video reached its stopAt. Swaps the Play chip for a Restart
  // chip — replaying the clip is the rarer intent, so it requires an
  // explicit click; forward nav (Space / PageDown) closes the modal and
  // returns to the deck.
  const [atEnd, setAtEnd] = useState(false)
  // YouTube-style cursor idle tracking: controls fade out a couple of seconds
  // after the last mouse movement. Any movement flips them back on.
  const [cursorActive, setCursorActive] = useState(true)
  const idleTimerRef = useRef<number | null>(null)

  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const wasPlayingRef = useRef(false)
  const dragStartRef = useRef<
    { x: number; pointerId: number; anchorTime: number } | null
  >(null)

  // VideoDemo stays mounted (returns null) when no demo is active, so
  // React preserves our local state across close/reopen. Reset on new demo.
  useEffect(() => {
    setAwaitingResume(false)
    setAtEnd(false)
    setCurrentTime(0)
    setDuration(0)
  }, [demo])

  // Track currentTime + duration so the scrub bar stays in sync with the
  // underlying <video>. timeupdate fires ~4× per second during playback,
  // which is plenty for a progress bar.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => setCurrentTime(video.currentTime)
    const onMeta = () =>
      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('durationchange', onMeta)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('durationchange', onMeta)
    }
  }, [demo])

  // Sync the resume indicator with actual playback state so external pauses
  // (e.g. end of file, browser-initiated pause) flip it on, and any play
  // event flips it off. The `ended` event also flips atEnd on so videos
  // without a stopAt cue still hit the carry-on close path naturally —
  // critical for trailing videos that simply play through.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPause = () => setAwaitingResume(true)
    const onPlay = () => {
      setAwaitingResume(false)
      setAtEnd(false)
    }
    const onEnded = () => setAtEnd(true)
    video.addEventListener('pause', onPause)
    video.addEventListener('play', onPlay)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('pause', onPause)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('ended', onEnded)
    }
  }, [demo])

  const src = useMemo(() => {
    if (!demo || !rootPath) return ''
    const raw = demo.src
    // Remote URL? pass through. Local path? resolve against project root.
    if (/^https?:\/\//i.test(raw)) return raw
    const cleaned = raw.replace(/^\.\//, '')
    const absolute = cleaned.startsWith('/') || /^[A-Za-z]:[\\/]/.test(cleaned)
      ? cleaned
      : `${rootPath}/${cleaned}`
    return convertProjectFileSrc(absolute)
  }, [demo, rootPath])

  // Seek to startAt on metadata load, then autoplay. The <video> element's
  // autoPlay attr covers the play side once the seek lands.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !demo) return
    const onLoaded = () => {
      if (demo.startAt) video.currentTime = demo.startAt
      video.play().catch(() => {
        // autoplay can be blocked in some edge cases; user can press Space.
        setAwaitingResume(true)
      })
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [demo])

  const onCueReached = useCallback((_event: VideoCueEvent) => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    setAwaitingResume(true)
  }, [])

  const onStopAt = useCallback(() => {
    // Pause at the stop point rather than closing — lets the presenter
    // linger on the last frame before forward nav (Space / PageDown / Esc /
    // the X) closes and returns to the deck. The Play chip is replaced with
    // a Restart chip for the deliberate "play it again" case.
    videoRef.current?.pause()
    setAtEnd(true)
  }, [])

  const restart = useCallback(() => {
    const video = videoRef.current
    if (!video || !demo) return
    video.currentTime = demo.startAt ?? 0
    setAtEnd(false)
    void video.play()
  }, [demo])

  useVideoCues({
    videoRef,
    cues: demo?.cues,
    startAt: demo?.startAt,
    stopAt: demo?.stopAt,
    onCueReached,
    onStopAt,
  })

  // Scrub-bar geometry. The "playable range" is [startAt, stopAt ?? duration]
  // — same window the cue logic operates on — so the bar reflects the clip
  // the presenter actually sees, not the raw underlying file.
  const rangeStart = demo?.startAt ?? 0
  const rangeEnd = demo?.stopAt ?? duration
  const span = Math.max(0.0001, rangeEnd - rangeStart)
  const progress = Math.max(
    0,
    Math.min(1, (currentTime - rangeStart) / span),
  )

  const visibleCues = useMemo(() => {
    if (!demo?.cues) return []
    return demo.cues.filter((c) => c.time >= rangeStart && c.time <= rangeEnd)
  }, [demo, rangeStart, rangeEnd])

  // Relative scrub: a drag of N pixels on screen moves the playhead by
  // (N / barWidth) × span seconds. The bar's track rect is the reference so
  // the cursor and the on-bar playhead track 1:1 visually. The seek is
  // anchored at the time the drag began — drag right to go forward from
  // there, drag left to go back, drag back to the origin to undo.
  const seekFromDelta = useCallback(
    (deltaPx: number, anchorTime: number) => {
      const track = trackRef.current
      const video = videoRef.current
      if (!track || !video) return
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return
      const deltaTime = (deltaPx / rect.width) * span
      const newTime = Math.max(
        rangeStart,
        Math.min(rangeEnd, anchorTime + deltaTime),
      )
      video.currentTime = newTime
    },
    [rangeStart, rangeEnd, span],
  )

  // Drag the video itself to scrub. The bar at the bottom is visual feedback
  // only — it appears as soon as the user crosses a small movement threshold
  // and fades back out on release. A 4px threshold keeps stray clicks from
  // briefly flashing the bar; a real drag promotes to a scrub.
  const DRAG_THRESHOLD_PX = 4

  const onVideoPointerDown = (e: React.PointerEvent<HTMLVideoElement>) => {
    if (e.button !== 0) return
    const video = videoRef.current
    if (!video) return
    dragStartRef.current = {
      x: e.clientX,
      pointerId: e.pointerId,
      anchorTime: video.currentTime,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // setPointerCapture can throw on synthetic events / detached elements.
    }
  }
  const onVideoPointerMove = (e: React.PointerEvent<HTMLVideoElement>) => {
    const start = dragStartRef.current
    if (!start) return
    const deltaPx = e.clientX - start.x
    if (!scrubbing) {
      if (Math.abs(deltaPx) < DRAG_THRESHOLD_PX) return
      const video = videoRef.current
      if (!video) return
      wasPlayingRef.current = !video.paused
      video.pause()
      setScrubbing(true)
    }
    seekFromDelta(deltaPx, start.anchorTime)
  }
  const onVideoPointerUp = (e: React.PointerEvent<HTMLVideoElement>) => {
    const start = dragStartRef.current
    if (!start) return
    dragStartRef.current = null
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      // releasePointerCapture can throw if capture was already lost.
    }
    if (!scrubbing) return
    setScrubbing(false)
    const video = videoRef.current
    if (!video) return
    const stopAt = demo?.stopAt
    const beforeStop = stopAt === undefined || video.currentTime < stopAt - 0.05
    if (wasPlayingRef.current && beforeStop) {
      void video.play()
    }
  }

  const controlsVisible = cursorActive

  // Bump the cursor-idle state: flip controls visible, reset the 2s timer.
  // Shared between mouse events and the Space keyboard handler so resuming
  // via keyboard starts the same fade-out countdown as a mouse interaction.
  const bumpCursorActivity = useCallback(() => {
    setCursorActive(true)
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = window.setTimeout(() => {
      setCursorActive(false)
      idleTimerRef.current = null
    }, 1200)
  }, [])

  useEffect(() => {
    if (!demo) return
    bumpCursorActivity() // start the timer immediately
    window.addEventListener('mousemove', bumpCursorActivity)
    window.addEventListener('mousedown', bumpCursorActivity)
    return () => {
      window.removeEventListener('mousemove', bumpCursorActivity)
      window.removeEventListener('mousedown', bumpCursorActivity)
      if (idleTimerRef.current != null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
  }, [demo, bumpCursorActivity])

  // Keyboard map while the modal is up:
  //   Cmd+W / Ctrl+W / PageUp -> close (back to editor) — always stays put.
  //                              Escape is deliberately NOT bound: it's too
  //                              easy to fat-finger mid-clip and losing the
  //                              playback position is expensive (rewatch
  //                              from the start). A modifier-keyed close
  //                              is the universal "close current thing"
  //                              shortcut and harder to hit by accident.
  //   Space / PageDown  -> toggle play/pause; once the clip has hit its
  //                        stopAt, this is the "carry on" close. For a
  //                        regular (lead-with-video) demo it just
  //                        dismisses the modal and the next forward press
  //                        advances the deck. For a trailing
  //                        (autoLaunch: 'end') demo it advances the
  //                        deck in the same press, since the trailing
  //                        video IS the leaving act.
  // PageUp / PageDown are here so a presentation clicker that emits those
  // codes (most wireless remotes do) drives playback instead of leaking
  // through to the stage-navigation shortcut.
  useEffect(() => {
    if (!demo) return
    const onKey = (e: KeyboardEvent) => {
      const isCloseShortcut =
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key === 'w' || e.key === 'W')
      if (isCloseShortcut || e.code === 'PageUp') {
        e.preventDefault()
        e.stopPropagation()
        closeDemo()
        return
      }
      if (e.code === 'Space' || e.key === ' ' || e.code === 'PageDown') {
        e.preventDefault()
        e.stopPropagation()
        const video = videoRef.current
        if (!video) return
        if (atEnd) {
          closeDemo()
          if (trailing) switchScreenRelative(1)
          return
        }
        if (video.paused) {
          setAwaitingResume(false)
          void video.play()
        } else {
          video.pause()
          setAwaitingResume(true)
        }
        bumpCursorActivity()
      }
    }
    // Capture phase so global Prezl shortcuts (Ctrl+Space branch nav,
    // Ctrl+Enter run, etc.) can't swallow these while the modal is up.
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [demo, closeDemo, bumpCursorActivity, atEnd, trailing, switchScreenRelative])

  if (!demo) return null

  return (
    <div
      className="fixed inset-0 z-50 isolate flex items-center justify-center bg-black"
      style={{ cursor: controlsVisible ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        onPointerDown={onVideoPointerDown}
        onPointerMove={onVideoPointerMove}
        onPointerUp={onVideoPointerUp}
        onPointerCancel={onVideoPointerUp}
        className="relative z-0 h-full w-full touch-none select-none object-contain"
        // Chromium promotes <video> to a hardware overlay plane during active
        // playback; that plane paints over regular DOM regardless of z-index.
        // Any CSS `filter` opts out of the overlay plane and back into normal
        // compositing where our close button and overlay can stack above.
        style={{ filter: 'brightness(1)' }}
      />
      <button
        type="button"
        onClick={closeDemo}
        aria-label="Close demo"
        title="Close (Esc)"
        className={`absolute right-6 top-6 z-10 grid size-10 place-items-center rounded-full border border-white/20 bg-black/75 text-white shadow-lg transition-opacity duration-200 hover:bg-black/90 ${
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <X className="size-6" />
      </button>
      {awaitingResume ? (
        atEnd ? (
          <button
            type="button"
            onClick={restart}
            aria-label="Restart"
            title="Restart"
            className="absolute bottom-12 left-1/2 z-50 grid size-14 -translate-x-1/2 animate-pulse place-items-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/20 backdrop-blur transition hover:animate-none hover:bg-black hover:ring-white/40"
          >
            <RotateCcw className="size-6 transition-transform hover:scale-110" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current
              if (!video) return
              void video.play()
            }}
            aria-label="Resume"
            title="Resume (Space)"
            className="absolute bottom-12 left-1/2 z-50 grid size-14 -translate-x-1/2 animate-pulse place-items-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/20 backdrop-blur transition hover:animate-none hover:bg-black hover:ring-white/40"
          >
            <Play className="size-6 fill-current transition-transform hover:scale-110" />
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={() => videoRef.current?.pause()}
          aria-label="Pause"
          title="Pause (Space)"
          className={`absolute bottom-12 left-1/2 z-50 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/20 backdrop-blur transition-opacity duration-200 hover:bg-black hover:ring-white/40 ${
            controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <Pause className="size-6 fill-current transition-transform hover:scale-110" />
        </button>
      )}
      <div
        ref={trackRef}
        className={`pointer-events-none absolute inset-x-6 bottom-0 z-20 px-1 pb-3 pt-4 transition-opacity duration-200 ${
          scrubbing ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="relative h-1.5 w-full rounded-full bg-black/50 ring-4 ring-black/60">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${progress * 100}%` }}
          />
          {visibleCues.map((cue, i) => {
            const left = ((cue.time - rangeStart) / span) * 100
            return (
              <div
                key={`${cue.time}-${i}`}
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-app-accent)] ring-2 ring-black/60"
                style={{ left: `${left}%` }}
              />
            )
          })}
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg ring-1 ring-black/40"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
