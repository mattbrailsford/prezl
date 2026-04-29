import { useEffect, useRef, useState } from 'react'
import { Globe, Play } from 'lucide-react'
import { useAppStore } from '@/state/store'
import type { Demo } from '@/types'

/**
 * Picker that opens when the Run action fires on a screen whose resolved
 * demo list has more than one entry. Mirrors the SymbolFinder pattern:
 * arrow keys cycle, Enter selects, Esc closes, click-outside closes.
 *
 * All hooks live above the early `return null` — adding a hook below it
 * would change the hook order between mounts and crash React.
 */
export function DemoPicker() {
  const demos = useAppStore((s) =>
    s.demoState.kind === 'picker' ? s.demoState.demos : null,
  )
  const closeDemo = useAppStore((s) => s.closeDemo)
  const runDemo = useAppStore((s) => s.runDemo)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLUListElement | null>(null)

  // Reset selection on every fresh open. Reference comparison is enough
  // since the store hands out a fresh list per picker session.
  useEffect(() => {
    if (demos) setSelectedIndex(0)
  }, [demos])

  useEffect(() => {
    if (!demos) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeDemo()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const chosen = demos[selectedIndex]
        if (chosen) void runDemo(chosen)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((i) => Math.min(demos.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((i) => Math.max(0, i - 1))
        return
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [demos, selectedIndex, closeDemo, runDemo])

  // Scroll the selected row into view when arrow-keying past the visible
  // window. Cheap; runs once per selection change.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const row = list.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, demos])

  if (!demos) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
      onClick={closeDemo}
    >
      <div
        role="dialog"
        aria-label="Choose a demo to run"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[60vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-2xl"
      >
        <div className="border-b border-app-border bg-app-panel px-4 py-3 text-sm font-semibold text-app">
          Choose a demo to run
        </div>
        <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {demos.map((p, idx) => (
            <li key={demoKey(p, idx)} data-idx={idx}>
              <button
                type="button"
                onClick={() => void runDemo(p)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                  idx === selectedIndex
                    ? 'border-app-accent bg-app-panel text-app'
                    : 'border-transparent text-app-muted hover:bg-app-panel/60 hover:text-app'
                }`}
              >
                <DemoIcon demo={p} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {demoLabel(p)}
                  </div>
                  {demoSubtitle(p) ? (
                    <div className="truncate text-xs text-app-muted">
                      {demoSubtitle(p)}
                    </div>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function DemoIcon({ demo }: { demo: Demo }) {
  if (demo.type === 'url') {
    return <Globe className="size-5 shrink-0 text-app-muted" />
  }
  return <Play className="size-5 shrink-0 fill-current text-app-muted" />
}

function demoLabel(p: Demo): string {
  // Author-supplied title wins — useful when two entries share a src.
  if (p.title) return p.title
  if (p.type === 'url') return p.src
  return videoBasename(p.src)
}

/** Subtitle confirms the underlying source so the presenter can verify
 *  what they're about to launch. Skipped when there's no title because
 *  the label IS the source in that case — duplicating it is just noise. */
function demoSubtitle(p: Demo): string {
  if (!p.title) return ''
  if (p.type === 'url') return p.src
  return videoBasename(p.src)
}

function videoBasename(src: string): string {
  const slash = Math.max(src.lastIndexOf('/'), src.lastIndexOf('\\'))
  return slash >= 0 ? src.slice(slash + 1) : src
}

function demoKey(p: Demo, idx: number): string {
  return `${p.type}:${p.src}:${idx}`
}
