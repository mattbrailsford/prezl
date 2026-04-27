import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PanelLeftOpen, X } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { fileTypeStyle } from '@/project/fileTypeStyles'

export function EditorTabs() {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeFile = useAppStore((s) => s.activeFile)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const closeTab = useAppStore((s) => s.closeTab)
  const explorerCollapsed = useAppStore((s) => s.preferences.explorerCollapsed)
  const setPreferences = useAppStore((s) => s.setPreferences)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeTabRef = useRef<HTMLDivElement | null>(null)
  // Cross-handler drag state — refs so we don't trigger React re-renders
  // mid-pan. `hasDragged` is read by the click-capture handler to decide
  // whether to swallow the trailing click after a drag-pan.
  const dragStartX = useRef(0)
  const dragStartScrollLeft = useRef(0)
  const hasDragged = useRef(false)

  // Edge-fade indicators: subtle gradient overlays at the strip's left
  // and right edges that appear only when there's content to scroll to
  // in that direction. Replaces the missing scrollbar's affordance.
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const updateFades = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeFile])

  // Re-check fade visibility on tab list change (scrollWidth shifts when
  // tabs are added/removed and ResizeObserver doesn't fire for that).
  useLayoutEffect(() => {
    updateFades()
  }, [openTabs, updateFades])

  // ResizeObserver covers strip-width changes (window resize, explorer
  // collapse/expand, drag of the explorer resize handle).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(updateFades)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateFades])

  // Drag-to-pan: the tab strip is overflow-x:auto with the scrollbar
  // hidden. Mouse-down on the strip starts a temporary window-level
  // mousemove/mouseup pair that updates scrollLeft, so the drag survives
  // the cursor leaving the strip. If the cursor moves more than a few
  // pixels we flag it as a drag and the click-capture handler swallows
  // the trailing click so we don't accidentally activate / close a tab.
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !scrollRef.current) return
    hasDragged.current = false
    dragStartX.current = e.clientX
    dragStartScrollLeft.current = scrollRef.current.scrollLeft
    const onMove = (ev: MouseEvent) => {
      if (!scrollRef.current) return
      const dx = ev.clientX - dragStartX.current
      if (Math.abs(dx) > 4) hasDragged.current = true
      scrollRef.current.scrollLeft = dragStartScrollLeft.current - dx
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onClickCapture = (e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  const expandExplorerButton = explorerCollapsed ? (
    <button
      type="button"
      onClick={() => setPreferences({ explorerCollapsed: false })}
      title="Show explorer (Ctrl+E)"
      aria-label="Show explorer"
      className="grid h-11 w-11 shrink-0 place-items-center border-b border-r border-app-border text-app-muted hover:bg-app-panel hover:text-app"
    >
      <PanelLeftOpen className="size-5" />
    </button>
  ) : null

  if (openTabs.length === 0) {
    // Hide the tab strip entirely when nothing is open — the editor pane
    // is just a clean empty state. Exception: if the explorer is also
    // collapsed, keep the strip so its expand-explorer button stays
    // reachable (otherwise the user has no UI affordance to bring the
    // file tree back).
    if (!explorerCollapsed) return null
    return (
      <div className="flex h-11 items-stretch bg-app-panel">
        {expandExplorerButton}
        <div className="flex flex-1 items-center border-b border-app-border" />
      </div>
    )
  }

  // Active vs inactive: inactive tabs are bg-app-panel (lighter) with a
  // bottom border that lines up with the strip's edge; the active tab
  // drops to bg-app-surface (matching CodeView below) with no bottom
  // border, giving the "tab merges into editor" look. Both reserve a 2px
  // top border via border-t-2; only the active tab fills it with the
  // file-type accent colour, which prevents a 2px content-jump on switch.
  return (
    <div className="flex h-11 items-stretch bg-app-surface">
      {expandExplorerButton}
      <div className="relative flex min-w-0 flex-1 items-stretch">
        <div
          ref={scrollRef}
          onMouseDown={onMouseDown}
          onClickCapture={onClickCapture}
          onScroll={updateFades}
          className="flex flex-1 items-stretch overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {openTabs.map((path) => {
            const isActive = path === activeFile
            const name = path.split('/').pop() ?? path
            const accent = fileTypeStyle(name)?.topBorderColor ?? 'border-t-app-accent'
            return (
              <div
                key={path}
                ref={isActive ? activeTabRef : null}
                className={`group flex h-11 shrink-0 items-center gap-2 border-r border-app-border px-3 text-base border-t-2 ${
                  isActive
                    ? `bg-app-surface text-app ${accent}`
                    : `border-t-transparent border-b border-b-app-border bg-app-panel text-app-muted hover:text-app`
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFile(path)}
                  className="whitespace-nowrap py-2 pr-1"
                  title={path}
                >
                  {name}
                </button>
                <button
                  type="button"
                  onClick={() => closeTab(path)}
                  className="grid size-7 place-items-center rounded text-app-muted hover:bg-app-border hover:text-app"
                  title="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
            )
          })}
          {/* Spacer fills the empty area to the right of the last tab so
              the strip's bottom edge keeps a continuous border-b where
              no tab lives. */}
          <div className="h-11 flex-1 border-b border-app-border" aria-hidden />
        </div>
        {/* Edge fades signal "more tabs this way". Rendered as overlays
            outside the scroll container so they don't pan with the
            content. pointer-events-none keeps drag-to-pan working
            through them. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-app-surface to-transparent transition-opacity duration-150 ${
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-app-surface to-transparent transition-opacity duration-150 ${
            canScrollRight ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </div>
  )
}
