import { useEffect, useRef, type ReactNode } from 'react'
import { useAppStore } from '@/state/store'

const STEP = 0.5
const MIN = 1
const MAX = 4

// Edge-pan: within EDGE_MARGIN px of a screen edge the view starts nudging
// that way, ramping from 0 at the margin boundary to EDGE_MAX_SPEED px/frame
// right at the edge. The cursor itself never drags the view — it only steers.
const EDGE_MARGIN = 90
const EDGE_MAX_SPEED = 16

// Eased zoom in/out. Applied ONLY across a level change — cleared the moment
// edge-panning takes over, since a transition on the per-frame pan transform
// would lag the pan behind the cursor.
const ZOOM_TRANSITION = 'transform 140ms ease'

function clampLevel(v: number): number {
  return Math.max(MIN, Math.min(MAX, Math.round(v * 2) / 2))
}

/**
 * Prezl-native magnifier — a CSS-transform zoom over the app content (editor
 * AND video modal). Distinct from `useUiScale`'s reflow zoom (Ctrl/Cmd+=):
 * that changes font size and relayouts; this optically enlarges a region the
 * way macOS screen zoom does, but bound to keys Prezl controls so it can't
 * collide with the OS gesture that was triggering the video context menu.
 *
 *   Ctrl/Cmd+Shift+Z       toggle 1× ↔ 2×
 *   Ctrl/Cmd+Shift+= / -   step the level
 *   Ctrl/Cmd+Shift+0 / Esc reset to 1×
 *
 * Zoom is **anchored at the cursor** — the content point under the pointer
 * when you trigger zoom stays put (`translate(cx·(1-s), cy·(1-s))`, origin
 * 0 0). After that the view does NOT follow the cursor; instead, moving the
 * pointer into the EDGE_MARGIN band nudges the magnified region that way
 * (RTS-style edge scroll) via a rAF loop, clamped so you never pan past the
 * content into empty space. All transform writes go straight to the wrapper
 * element — never through React state — so panning runs at frame rate with
 * zero re-renders.
 */
export function ZoomViewport({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const setStatusMessage = useAppStore((s) => s.setStatusMessage)

  useEffect(() => {
    // All live state is local to the effect (refs would be overkill — nothing
    // outside this closure reads it). `s` is the zoom level; `tx`/`ty` the
    // pan translation; `cursor` the latest pointer position used only to
    // steer edge-panning.
    let s = 1
    let tx = 0
    let ty = 0
    const cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    let raf: number | null = null
    let hideTimer: number | null = null
    let transitionTimer: number | null = null

    // Drop the zoom transition so subsequent transform writes (edge-pan) are
    // instant. Safe to call repeatedly.
    const clearTransition = () => {
      if (transitionTimer) {
        window.clearTimeout(transitionTimer)
        transitionTimer = null
      }
      const el = wrapRef.current
      if (el && el.style.transition) el.style.transition = ''
    }

    // Keep [tx, ty] within the range that keeps content covering the viewport
    // — tx ∈ [W(1-s), 0], same for y. Prevents panning into empty margins.
    const clampPan = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      tx = Math.max(w * (1 - s), Math.min(0, tx))
      ty = Math.max(h * (1 - s), Math.min(0, ty))
    }

    const apply = () => {
      const el = wrapRef.current
      if (!el) return
      // Identity (not '') at 1× so a reset animates back to it; an empty
      // string would snap.
      el.style.transform =
        s === 1 ? 'translate(0px, 0px) scale(1)' : `translate(${tx}px, ${ty}px) scale(${s})`
    }

    const flash = () => {
      setStatusMessage(s === 1 ? 'Magnify: off' : `Magnify: ${Math.round(s * 100)}%`)
      if (hideTimer) window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => {
        setStatusMessage('Ready')
        hideTimer = null
      }, 1200)
    }

    const tick = () => {
      if (s === 1) {
        raf = null
        return
      }
      const w = window.innerWidth
      const h = window.innerHeight
      let vx = 0
      let vy = 0
      if (cursor.x < EDGE_MARGIN) {
        vx = ((EDGE_MARGIN - cursor.x) / EDGE_MARGIN) * EDGE_MAX_SPEED
      } else if (cursor.x > w - EDGE_MARGIN) {
        vx = -((cursor.x - (w - EDGE_MARGIN)) / EDGE_MARGIN) * EDGE_MAX_SPEED
      }
      if (cursor.y < EDGE_MARGIN) {
        vy = ((EDGE_MARGIN - cursor.y) / EDGE_MARGIN) * EDGE_MAX_SPEED
      } else if (cursor.y > h - EDGE_MARGIN) {
        vy = -((cursor.y - (h - EDGE_MARGIN)) / EDGE_MARGIN) * EDGE_MAX_SPEED
      }
      if (vx !== 0 || vy !== 0) {
        // Panning has taken over — kill any in-flight zoom ease so the view
        // tracks the edge nudge frame-for-frame.
        clearTransition()
        tx += vx
        ty += vy
        clampPan()
        apply()
      }
      raf = requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (raf == null) raf = requestAnimationFrame(tick)
    }
    const stopLoop = () => {
      if (raf != null) {
        cancelAnimationFrame(raf)
        raf = null
      }
    }

    const setLevel = (next: number) => {
      const clamped = clampLevel(next)
      if (clamped === s) return
      // Arm the eased transition for this level change. Force a style flush
      // first so the browser commits the CURRENT transform as the animation's
      // start value, then writing the new transform animates from it.
      const el = wrapRef.current
      if (el) {
        el.style.transition = ZOOM_TRANSITION
        void el.offsetWidth
      }
      s = clamped
      // Re-anchor on the cursor at every level change so zoom always centres
      // where you're pointing.
      tx = cursor.x * (1 - s)
      ty = cursor.y * (1 - s)
      clampPan()
      apply()
      flash()
      // Drop the transition once the ease completes so edge-pan stays instant.
      if (transitionTimer) window.clearTimeout(transitionTimer)
      transitionTimer = window.setTimeout(clearTransition, 160)
      if (s === 1) stopLoop()
      else startLoop()
    }

    const onMove = (e: MouseEvent) => {
      cursor.x = e.clientX
      cursor.y = e.clientY
    }

    const onKey = (e: KeyboardEvent) => {
      // Esc resets, but only when zoomed — otherwise let it keep any other
      // meaning it has elsewhere.
      if (e.key === 'Escape' && s !== 1) {
        e.preventDefault()
        e.stopPropagation()
        setLevel(1)
        return
      }
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return
      switch (e.code) {
        case 'KeyZ': {
          e.preventDefault()
          e.stopPropagation()
          // Read the toggle target live so a settings change applies without
          // re-running this effect.
          const toggle = useAppStore.getState().preferences.magnifyToggleLevel
          setLevel(s === 1 ? toggle : 1)
          break
        }
        case 'Equal':
          e.preventDefault()
          e.stopPropagation()
          setLevel(s + STEP)
          break
        case 'Minus':
          e.preventDefault()
          e.stopPropagation()
          setLevel(s - STEP)
          break
        case 'Digit0':
          e.preventDefault()
          e.stopPropagation()
          setLevel(1)
          break
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('keydown', onKey, { capture: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
      stopLoop()
      if (hideTimer) window.clearTimeout(hideTimer)
      if (transitionTimer) window.clearTimeout(transitionTimer)
    }
  }, [setStatusMessage])

  return (
    <div
      ref={wrapRef}
      className="zoom-viewport"
      style={{ transformOrigin: '0 0', height: '100%' }}
    >
      {children}
    </div>
  )
}
