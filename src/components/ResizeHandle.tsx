import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/state/store'
import { EXPLORER_MAX_WIDTH, EXPLORER_MIN_WIDTH } from '@/types'

export function ExplorerResizeHandle() {
  const setPreferences = useAppStore((s) => s.setPreferences)
  const [isDragging, setIsDragging] = useState(false)
  const rafRef = useRef<number | null>(null)
  const pendingWidth = useRef<number | null>(null)

  const commitWidth = useCallback(() => {
    if (pendingWidth.current != null) {
      setPreferences({ explorerWidth: pendingWidth.current })
    }
    rafRef.current = null
  }, [setPreferences])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const onMouseMove = (ev: MouseEvent) => {
      const next = Math.max(
        EXPLORER_MIN_WIDTH,
        Math.min(EXPLORER_MAX_WIDTH, ev.clientX),
      )
      pendingWidth.current = next
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(commitWidth)
      }
    }

    const onMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        commitWidth()
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  return (
    <div
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
      className={`group relative w-px shrink-0 cursor-col-resize bg-app-border transition-colors ${
        isDragging ? 'bg-app-accent' : 'hover:bg-app-accent'
      }`}
    >
      {/* Wider hit area so users don't have to hit the 1px line precisely */}
      <div className="absolute inset-y-0 -left-1 w-3" />
    </div>
  )
}
