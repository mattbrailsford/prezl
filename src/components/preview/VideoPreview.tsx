import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { useVideoCues, type VideoCueEvent } from '@/hooks/useVideoCues'

export function VideoPreview() {
  const preview = useAppStore((s) =>
    s.previewState.kind === 'video' ? s.previewState.preview : null,
  )
  const rootPath = useAppStore((s) => s.project?.rootPath ?? null)
  const closePreview = useAppStore((s) => s.closePreview)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [awaitingResume, setAwaitingResume] = useState(false)
  // Set when the video reached its stopAt. Swaps the Play chip for a Restart
  // chip so the presenter can re-run the clip without closing first.
  const [atEnd, setAtEnd] = useState(false)
  // YouTube-style cursor idle tracking: controls fade out a couple of seconds
  // after the last mouse movement. Any movement flips them back on.
  const [cursorActive, setCursorActive] = useState(true)
  const idleTimerRef = useRef<number | null>(null)

  // VideoPreview stays mounted (returns null) when no preview is active, so
  // React preserves our local state across close/reopen. Reset on new preview.
  useEffect(() => {
    setAwaitingResume(false)
    setAtEnd(false)
  }, [preview])

  // Sync the resume indicator with actual playback state so external pauses
  // (e.g. end of file, browser-initiated pause) flip it on, and any play
  // event flips it off.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPause = () => setAwaitingResume(true)
    const onPlay = () => {
      setAwaitingResume(false)
      setAtEnd(false)
    }
    video.addEventListener('pause', onPause)
    video.addEventListener('play', onPlay)
    return () => {
      video.removeEventListener('pause', onPause)
      video.removeEventListener('play', onPlay)
    }
  }, [preview])

  const src = useMemo(() => {
    if (!preview || !rootPath) return ''
    const raw = preview.src
    // Remote URL? pass through. Local path? resolve against project root.
    if (/^https?:\/\//i.test(raw)) return raw
    const cleaned = raw.replace(/^\.\//, '')
    const absolute = cleaned.startsWith('/') || /^[A-Za-z]:[\\/]/.test(cleaned)
      ? cleaned
      : `${rootPath}/${cleaned}`
    return convertFileSrc(absolute)
  }, [preview, rootPath])

  // Seek to startAt on metadata load, then autoplay. The <video> element's
  // autoPlay attr covers the play side once the seek lands.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !preview) return
    const onLoaded = () => {
      if (preview.startAt) video.currentTime = preview.startAt
      video.play().catch(() => {
        // autoplay can be blocked in some edge cases; user can press Space.
        setAwaitingResume(true)
      })
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [preview])

  const onCueReached = useCallback((_event: VideoCueEvent) => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    setAwaitingResume(true)
  }, [])

  const onStopAt = useCallback(() => {
    // Pause at the stop point rather than closing — lets the presenter
    // linger on the last frame before hitting Esc / the X to dismiss. The
    // Play chip is replaced with a Restart chip so they can re-run the clip.
    videoRef.current?.pause()
    setAtEnd(true)
  }, [])

  const restart = useCallback(() => {
    const video = videoRef.current
    if (!video || !preview) return
    video.currentTime = preview.startAt ?? 0
    setAtEnd(false)
    void video.play()
  }, [preview])

  useVideoCues({
    videoRef,
    cues: preview?.cues,
    startAt: preview?.startAt,
    stopAt: preview?.stopAt,
    onCueReached,
    onStopAt,
  })

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
    if (!preview) return
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
  }, [preview, bumpCursorActivity])

  // Space = toggle play/pause + dismiss overlay. Esc = close.
  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closePreview()
        return
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        const video = videoRef.current
        if (!video) return
        if (atEnd) {
          restart()
        } else if (video.paused) {
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
  }, [preview, closePreview, bumpCursorActivity, atEnd, restart])

  if (!preview) return null

  return (
    <div
      className="fixed inset-0 z-50 isolate flex items-center justify-center bg-black"
      style={{ cursor: cursorActive ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        className="relative z-0 h-full w-full object-contain"
        // Chromium promotes <video> to a hardware overlay plane during active
        // playback; that plane paints over regular DOM regardless of z-index.
        // Any CSS `filter` opts out of the overlay plane and back into normal
        // compositing where our close button and overlay can stack above.
        style={{ filter: 'brightness(1)' }}
      />
      <button
        type="button"
        onClick={closePreview}
        aria-label="Close preview"
        title="Close (Esc)"
        className={`absolute right-6 top-6 z-10 grid size-10 place-items-center rounded-full border border-white/20 bg-black/75 text-white shadow-lg transition-opacity duration-200 hover:bg-black/90 ${
          cursorActive ? 'opacity-100' : 'pointer-events-none opacity-0'
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
            title="Restart (Space)"
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
            cursorActive ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <Pause className="size-6 fill-current transition-transform hover:scale-110" />
        </button>
      )}
    </div>
  )
}
