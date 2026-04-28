import { Check, ListChecks, Circle } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { useCurrentScreen, useSymbolTable } from '@/hooks/useRenderedFile'
import type { CoverItem } from '@/types'

/** Last path segment, used as the row label when the author didn't supply
 *  a `label`. Bare paths feel cleaner in the cover list than full relpaths. */
function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? path : path.slice(i + 1)
}

/** Stage agenda — a small list of files the presenter wants to remember to
 *  cover during the current stage. Shown under the explorer tree when the
 *  current screen has a resolved `cover:` list; hidden otherwise. Items are
 *  ticked once the file has been opened during the current stage's tenure
 *  (the store's `visitedFilesInStage`, cleared on cross-stage entry).
 *
 *  Rows route through `navigateToFileLine` when the cover item carries an
 *  id (resolved via the project-wide symbol table) or an explicit line, and
 *  through `openFile` otherwise. The symbol table lookup matches the click-
 *  to-jump path used elsewhere; if the id can't be resolved on the current
 *  screen (cover entry points at a file hidden by `file=` directive on this
 *  screen), we fall back to opening the file at the top — better than a
 *  silent no-op. */
export function StageCoverList() {
  const screen = useCurrentScreen()
  const cover = screen?.cover
  const visited = useAppStore((s) => s.visitedFilesInStage)
  const openFile = useAppStore((s) => s.openFile)
  const navigateToFileLine = useAppStore((s) => s.navigateToFileLine)
  const requestExplorerReveal = useAppStore((s) => s.requestExplorerReveal)
  const symbolTable = useSymbolTable()

  if (!cover || cover.length === 0) return null

  const handleClick = (item: CoverItem) => {
    if (item.id) {
      const target = symbolTable.get(item.id)
      if (target && target.file === item.file) {
        navigateToFileLine(item.file, target.line)
        requestExplorerReveal()
        return
      }
    }
    if (item.line) {
      navigateToFileLine(item.file, item.line)
      requestExplorerReveal()
      return
    }
    openFile(item.file)
    // Always force the explorer to expand the file's folder chain, even when
    // the click didn't change activeFile (clicking a cover entry whose file
    // is already active otherwise leaves the auto-reveal effect inert).
    requestExplorerReveal()
  }

  return (
    <div className="shrink-0 border-t border-app-border/60">
      <div className="flex items-center gap-2 pl-3 pr-2 pt-2 pb-1">
        <ListChecks className="size-4 shrink-0 text-app-muted" />
        <span className="text-xs font-semibold uppercase tracking-wider text-app-muted">
          Todo
        </span>
      </div>
      <ul className="max-h-48 overflow-y-auto pb-2">
        {cover.map((item, idx) => {
          const isVisited = visited.has(item.file)
          const Icon = isVisited ? Check : Circle
          const iconClasses = isVisited
            ? 'text-app-accent'
            : 'text-app-muted/60'
          const labelClasses = isVisited
            ? 'text-app-muted line-through decoration-app-muted/60'
            : 'text-app'
          const display = item.label ?? basename(item.file)
          return (
            <li key={`${item.file}#${item.id ?? item.line ?? ''}#${idx}`}>
              <button
                type="button"
                onClick={() => handleClick(item)}
                className="flex w-full items-center gap-2 py-1 pl-3 pr-2 text-left hover:bg-app-panel/60"
              >
                <Icon className={`size-4 shrink-0 ${iconClasses}`} />
                <span className={`truncate ${labelClasses}`}>{display}</span>
                {item.label && (
                  <span className="ml-auto truncate text-xs text-app-muted/70">
                    {basename(item.file)}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
