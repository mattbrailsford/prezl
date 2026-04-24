import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { useSymbolTable } from '@/hooks/useRenderedFile'
import { fuzzyFilter } from '@/project/fuzzyMatch'

type SymbolRow = { id: string; file: string; line: number }

export function SymbolFinder() {
  const open = useAppStore((s) => s.symbolFinderOpen)
  const closeSymbolFinder = useAppStore((s) => s.closeSymbolFinder)
  const navigateToFileLine = useAppStore((s) => s.navigateToFileLine)
  const symbolTable = useSymbolTable()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  const allRows = useMemo<SymbolRow[]>(() => {
    const rows: SymbolRow[] = []
    for (const [id, target] of symbolTable) {
      rows.push({ id, file: target.file, line: target.line })
    }
    rows.sort((a, b) => a.id.localeCompare(b.id))
    return rows
  }, [symbolTable])

  const results = useMemo(
    () => fuzzyFilter(allRows, (r) => r.id, query).slice(0, 20),
    [allRows, query],
  )

  // Reset query + selection whenever the modal opens; focus the input.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)
    // Focus after the modal commits so the autoFocus race isn't an issue.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  // Keep selection in bounds when results change.
  useEffect(() => {
    if (selectedIndex >= results.length) setSelectedIndex(Math.max(0, results.length - 1))
  }, [results, selectedIndex])

  // Scroll selected row into view.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const row = list.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, results])

  // Keyboard nav registered on window in capture phase so it preempts any
  // other global shortcuts and works regardless of focus landing on the
  // input vs a list row after hover. Declared BEFORE the early return below
  // because all hooks must be called in the same order every render.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeSymbolFinder()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const row = results[selectedIndex]
        if (row) {
          navigateToFileLine(row.file, row.line)
        }
        closeSymbolFinder()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((i) => Math.min(results.length - 1, i + 1))
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
  }, [open, results, selectedIndex, closeSymbolFinder, navigateToFileLine])

  if (!open) return null

  const commit = (row: SymbolRow | undefined) => {
    if (!row) {
      closeSymbolFinder()
      return
    }
    navigateToFileLine(row.file, row.line)
    closeSymbolFinder()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
      onClick={closeSymbolFinder}
    >
      <div
        role="dialog"
        aria-label="Find symbol"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[60vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-2xl"
      >
        <label className="flex items-center gap-2 border-b border-app-border bg-app-panel px-3 py-3">
          <Search className="size-5 shrink-0 text-app-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Find symbol…"
            className="w-full bg-transparent text-base text-app placeholder:text-app-muted focus:outline-none"
          />
        </label>
        <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-app-muted">
              {allRows.length === 0
                ? 'No symbols in this project yet — add @prezl id=<name> to mark them.'
                : 'No matches.'}
            </li>
          )}
          {results.map((row, idx) => (
            <li key={`${row.id}::${row.file}`} data-idx={idx}>
              <button
                type="button"
                onClick={() => commit(row)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex w-full items-baseline gap-3 border-l-2 px-4 py-2 text-left transition-colors ${
                  idx === selectedIndex
                    ? 'border-app-accent bg-app-panel text-app'
                    : 'border-transparent text-app-muted hover:bg-app-panel/60 hover:text-app'
                }`}
              >
                <span className="truncate font-mono text-sm font-semibold">
                  {row.id}
                </span>
                <span className="truncate text-xs text-app-muted">
                  {row.file}:{row.line}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
