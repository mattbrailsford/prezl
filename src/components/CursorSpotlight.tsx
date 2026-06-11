import { useEffect, useRef, type CSSProperties } from 'react'
import { useAppStore } from '@/state/store'
import { CURSOR_IDLE_MS } from '@/types'

/**
 * A halo that follows the mouse so an audience can track the presenter's
 * cursor through code. Toggled via `preferences.cursorSpotlight`
 * (Ctrl/Cmd+Shift+H — see `useCursorSpotlight`).
 *
 * Presentify-style behaviour:
 *   - dotted outer ring + translucent inner fill/ring (all CSS)
 *   - fades out after a short idle, back in on any pointer activity
 *   - scales down briefly on press, like a click ripple
 *
 * Two nested elements split the transforms so they don't fight: the wrapper
 * owns the cursor-following `translate` (written every mousemove, no
 * transition — it must track instantly), the inner halo owns the press
 * `scale` and the fade `opacity` (both transitioned). Everything is written
 * straight to the DOM from listeners, so cursor tracking costs zero
 * re-renders.
 *
 * Shows over the presentation surface — code AND video playback (it renders
 * above the video modal). Suppressed only over utility modals (demo picker,
 * symbol finder, settings) where you're clicking UI and the system cursor is
 * what matters.
 */
export function CursorSpotlight() {
  const enabled = useAppStore((s) => s.preferences.cursorSpotlight)
  const color = useAppStore((s) => s.preferences.cursorSpotlightColor)
  const size = useAppStore((s) => s.preferences.cursorSpotlightSize)
  const demoKind = useAppStore((s) => s.demoState.kind)
  const symbolFinderOpen = useAppStore((s) => s.symbolFinderOpen)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const haloRef = useRef<HTMLDivElement | null>(null)
  const idleTimer = useRef<number | null>(null)
  // Last known pointer position, tracked even while the halo is off so it can
  // appear at the cursor the instant it's toggled on — without waiting for
  // the next mousemove.
  const lastPointer = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

  const utilityModalOpen =
    symbolFinderOpen || settingsOpen || demoKind === 'picker'
  const active = enabled && !utilityModalOpen

  // Always-on pointer tracker (cheap; this component is permanently mounted).
  useEffect(() => {
    const track = (e: MouseEvent) => {
      lastPointer.current.x = e.clientX
      lastPointer.current.y = e.clientY
    }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  useEffect(() => {
    const halo = haloRef.current

    // Disabled / suppressed: fade out in place. The element stays mounted (we
    // never return null) so the opacity transition is actually visible — an
    // early unmount would just make it vanish.
    if (!active) {
      if (halo) {
        halo.style.opacity = '0'
        halo.style.transform = 'scale(1)'
      }
      if (idleTimer.current) {
        window.clearTimeout(idleTimer.current)
        idleTimer.current = null
      }
      return
    }

    const place = () => {
      const wrap = wrapRef.current
      if (wrap) {
        const { x, y } = lastPointer.current
        wrap.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`
      }
    }
    const wake = () => {
      const halo = haloRef.current
      if (halo) halo.style.opacity = '1'
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => {
        const h = haloRef.current
        if (h) h.style.opacity = '0'
        idleTimer.current = null
      }, CURSOR_IDLE_MS)
    }

    // Position at the current pointer, then fade in (the halo's committed
    // opacity:0 means setting it to 1 animates via the CSS transition).
    place()
    wake()

    const onMove = (e: MouseEvent) => {
      lastPointer.current.x = e.clientX
      lastPointer.current.y = e.clientY
      place()
      wake()
    }
    const onDown = () => {
      const halo = haloRef.current
      if (halo) halo.style.transform = 'scale(0.7)'
      wake()
    }
    const onUp = () => {
      const halo = haloRef.current
      if (halo) halo.style.transform = 'scale(1)'
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('mouseup', onUp, true)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mouseup', onUp, true)
      if (idleTimer.current) {
        window.clearTimeout(idleTimer.current)
        idleTimer.current = null
      }
    }
  }, [active, size])

  // Always mounted (even when disabled) so enable/disable both animate through
  // the halo's opacity transition rather than snapping. Size drives the box;
  // colour rides in as a custom property the CSS uses for both the dotted ring
  // and (via color-mix) the translucent inner ring.
  const wrapStyle = {
    width: size,
    height: size,
    '--halo-color': color,
  } as CSSProperties
  return (
    <div ref={wrapRef} className="cursor-spotlight-wrap" style={wrapStyle} aria-hidden>
      <div ref={haloRef} className="cursor-spotlight" />
    </div>
  )
}
