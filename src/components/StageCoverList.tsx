import { AlertTriangle, Check, Circle, ListChecks, Play } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { useCurrentScreen, useSymbolTable } from '@/hooks/useRenderedFile'
import type { CoverDemoItem, CoverFileItem, Demo } from '@/types'

/** Last path segment, used as the row label when the author didn't supply
 *  a `title`. Bare paths feel cleaner in the cover list than full relpaths. */
function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? path : path.slice(i + 1)
}

/** Demo subtitle for cover rows that supply a custom `title` — show the
 *  resolved demo's source after the title so the presenter can confirm what
 *  they're about to launch. Mirrors the picker's subtitle logic. */
function demoSourceLabel(demo: Demo): string {
  if (demo.type === 'url') return demo.src
  const slash = Math.max(demo.src.lastIndexOf('/'), demo.src.lastIndexOf('\\'))
  return slash >= 0 ? demo.src.slice(slash + 1) : demo.src
}

/** Stage agenda — a small list of files (and demo triggers) the presenter
 *  wants to remember to surface during the current stage. Shown under the
 *  explorer tree when the current screen has a resolved `cover:` list;
 *  hidden otherwise.
 *
 *  File entries tick once their file has been opened during the current
 *  stage's tenure (`visitedFilesInStage`). Demo entries tick once their
 *  demo id has been launched in the same scope (`launchedDemosInStage`).
 *  Both sets reset on cross-stage entry; within-stage cover-reference
 *  changes filter out entries listed under the new step's framing so the
 *  presenter is prompted to revisit them.
 *
 *  File rows route through `navigateToFileLine` when an `id` resolves on
 *  the current screen (or `line` is set), otherwise fall back to
 *  `openFile` — symbol resolution mirrors the click-to-jump path used in
 *  the code viewer. Demo rows route through `runDemo` against the
 *  project-wide `demosById` index, the same lookup markdown intros use
 *  for `[label](demo://<id>)` links. */
export function StageCoverList() {
  const screen = useCurrentScreen()
  const cover = screen?.cover
  const visited = useAppStore((s) => s.visitedFilesInStage)
  const launchedDemos = useAppStore((s) => s.launchedDemosInStage)
  const demosById = useAppStore((s) => s.demosById)
  const openFile = useAppStore((s) => s.openFile)
  const navigateToFileLine = useAppStore((s) => s.navigateToFileLine)
  const runDemo = useAppStore((s) => s.runDemo)
  const requestExplorerReveal = useAppStore((s) => s.requestExplorerReveal)
  const symbolTable = useSymbolTable()

  if (!cover || cover.length === 0) return null

  const handleFileClick = (item: CoverFileItem) => {
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

  const handleDemoClick = (item: CoverDemoItem) => {
    const demo = demosById.get(item.demoId)
    if (!demo) return
    void runDemo(demo)
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
        {cover.map((item, idx) =>
          item.kind === 'file' ? (
            <FileRow
              key={`f:${item.file}#${item.id ?? item.line ?? ''}#${idx}`}
              item={item}
              isVisited={visited.has(item.file)}
              onClick={handleFileClick}
            />
          ) : (
            <DemoRow
              key={`d:${item.demoId}#${idx}`}
              item={item}
              demo={demosById.get(item.demoId) ?? null}
              isVisited={launchedDemos.has(item.demoId)}
              onClick={handleDemoClick}
            />
          ),
        )}
      </ul>
    </div>
  )
}

function FileRow({
  item,
  isVisited,
  onClick,
}: {
  item: CoverFileItem
  isVisited: boolean
  onClick: (item: CoverFileItem) => void
}) {
  const Icon = isVisited ? Check : Circle
  const iconClasses = isVisited ? 'text-app-accent' : 'text-app-muted/60'
  const labelClasses = isVisited
    ? 'text-app-muted line-through decoration-app-muted/60'
    : 'text-app'
  const display = item.title ?? basename(item.file)
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(item)}
        className="flex w-full items-center gap-2 py-1 pl-3 pr-2 text-left hover:bg-app-panel/60"
      >
        <Icon className={`size-4 shrink-0 ${iconClasses}`} />
        <span className={`truncate ${labelClasses}`}>{display}</span>
        {item.title && (
          <span className="ml-auto truncate text-xs text-app-muted/70">
            {basename(item.file)}
          </span>
        )}
      </button>
    </li>
  )
}

/** Demo row variant — Play icon when unvisited, Check when launched, and
 *  AlertTriangle on an unresolved id (the presenter can still see the
 *  authoring intent without a typo silently doing nothing). Unresolved
 *  rows are click-disabled so they don't fire `runDemo(undefined)`. */
function DemoRow({
  item,
  demo,
  isVisited,
  onClick,
}: {
  item: CoverDemoItem
  demo: Demo | null
  isVisited: boolean
  onClick: (item: CoverDemoItem) => void
}) {
  const unresolved = demo == null
  const Icon = unresolved ? AlertTriangle : isVisited ? Check : Play
  const iconClasses = unresolved
    ? 'text-app-muted/60'
    : isVisited
      ? 'text-app-accent'
      : 'text-app-accent/80 fill-current'
  const labelClasses = unresolved
    ? 'text-app-muted/70'
    : isVisited
      ? 'text-app-muted line-through decoration-app-muted/60'
      : 'text-app'
  const display = item.title ?? (demo ? demoLabel(demo) : item.demoId)
  // Subtitle mirrors the picker pattern: when the author wrote a `title:`
  // for the cover row, surface the resolved demo's src on the right so the
  // presenter can verify the target. Skipped when no title (the label IS
  // the demo source).
  const subtitle = item.title && demo ? demoSourceLabel(demo) : null
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(item)}
        disabled={unresolved}
        title={unresolved ? `Unknown demo id: ${item.demoId}` : undefined}
        className="flex w-full items-center gap-2 py-1 pl-3 pr-2 text-left hover:bg-app-panel/60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <Icon className={`size-4 shrink-0 ${iconClasses}`} />
        <span className={`truncate ${labelClasses}`}>{display}</span>
        {subtitle && (
          <span className="ml-auto truncate text-xs text-app-muted/70">
            {subtitle}
          </span>
        )}
      </button>
    </li>
  )
}

function demoLabel(demo: Demo): string {
  if (demo.title) return demo.title
  return demoSourceLabel(demo)
}
