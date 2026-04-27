import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { saveScrollPosition, useAppStore } from '@/state/store'
import { editorFontSize } from '@/hooks/useUiScale'
import {
  useActiveRenderedFile,
  useCurrentScreen,
  useSymbolTable,
  type SymbolTable,
} from '@/hooks/useRenderedFile'
import { useProjectLogoSrc } from '@/hooks/useProjectLogoSrc'
import {
  PREZL_THEME,
  ShikiToken,
  getHighlighter,
  inferLanguage,
} from '@/project/shikiSetup'
import type { FoldRange, RenderedFile } from '@/project/directiveParser'
import { PretzelLogo } from './PretzelLogo'

/** Static, read-only code viewer. Replaces Monaco — about 2.5 MB of editor
 *  for a fake-IDE viewer was overkill. Uses Shiki for tokens and renders
 *  plain DOM for everything else: line numbers, fold widgets, focus
 *  decorations, and click-to-jump symbol underlines. */
export function CodeView() {
  const activeFile = useAppStore((s) => s.activeFile)
  const isBinaryFile = useAppStore(
    (s) => activeFile != null && s.binaryFiles.has(activeFile),
  )
  const uiScale = useAppStore((s) => s.preferences.uiScale)
  const screen = useCurrentScreen()
  const rendered = useActiveRenderedFile()
  const symbolTable = useSymbolTable()
  const navigateToFileLine = useAppStore((s) => s.navigateToFileLine)
  const pendingNavigation = useAppStore((s) => s.pendingNavigation)
  const consumePendingNavigation = useAppStore((s) =>
    s.consumePendingNavigation,
  )
  const pendingScrollTop = useAppStore((s) => s.pendingScrollTop)
  const consumePendingScrollTop = useAppStore((s) => s.consumePendingScrollTop)

  const containerRef = useRef<HTMLDivElement>(null)

  const language = useMemo(() => inferLanguage(activeFile), [activeFile])

  // Shiki tokens for the current rendered text. `null` means "highlighter not
  // ready yet"; we fall back to plain (uncoloured) rendering until tokens
  // arrive. No black screen — the code is visible immediately.
  const [tokens, setTokens] = useState<ShikiToken[][] | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!rendered) {
      setTokens(null)
      return
    }
    getHighlighter()
      .then((h) => {
        if (cancelled) return
        try {
          const result = h.codeToTokens(rendered.text, {
            lang: language,
            theme: PREZL_THEME,
          })
          setTokens(result.tokens)
        } catch {
          // Unsupported language or grammar load failure → plain render.
          setTokens(null)
        }
      })
      .catch(() => {
        /* non-fatal; keep plain render */
      })
    return () => {
      cancelled = true
    }
  }, [rendered, language])

  // Collapsed fold state, keyed by `${start}-${end}` per fold range. Re-seeded
  // from rendered.foldRanges on every (file, screen) change so directive-driven
  // initial collapse always wins on every step transition, not just stage ones.
  const fileStageKey = `${activeFile ?? ''}::${screen?.id ?? ''}`
  const [collapsedFolds, setCollapsedFolds] = useState<Set<string>>(new Set())
  const lastSeededKey = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!rendered) return
    if (lastSeededKey.current === fileStageKey) return
    lastSeededKey.current = fileStageKey
    const initial = new Set<string>()
    for (const r of rendered.foldRanges) initial.add(foldKey(r))
    setCollapsedFolds(initial)
  }, [rendered, fileStageKey])

  const toggleFold = (range: FoldRange) => {
    const key = foldKey(range)
    setCollapsedFolds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Scroll handling has two distinct triggers; we keep them separate so the
  // pendingNavigation consumption (which causes a re-render) doesn't make the
  // (file, screen) branch undo the scroll on its second pass.
  //
  // Branch A — fires once per (file, screen) change. Priority:
  //   1. pendingScrollTop (back/forward restore — exact pixel position)
  //   2. one-shot pendingNavigation (symbol jump that opened this file)
  //   3. screen.open
  //   4. top of file
  //
  // Branch B — fires when a same-file pendingNavigation arrives and the
  //   (file, screen) hasn't changed (clicking a symbol that lives in the
  //   currently-open file). It scrolls to the target line and consumes the
  //   pending nav without resetting scrollTop afterwards.
  const lastScrolledKey = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!rendered || !containerRef.current) return
    const container = containerRef.current

    // `flash=true` is only for explicit user jumps (symbol click → a
    // pendingNavigation). The screen.open path runs on every screen/file
    // change and would flash distractingly on each step advance.
    const scrollToLine = (line: number, flash: boolean) => {
      // If the target sits inside one or more fold ranges, expand them so
      // the line is reachable. Manual re-collapse via the toggle still
      // works after the jump. We always defer the scroll to the next
      // frame in this branch — in cross-file jumps the seeding effect's
      // setCollapsedFolds hasn't committed yet, so the line we'd query
      // for now would be hidden a tick later.
      // Include r.start: the fold's start line is its visible header (e.g.
      // `type Foo = {` on the `DashboardConfig` fold), so a click on that
      // line is technically "visible" — but a symbol jump targets that
      // header and the user's intent is to see the body, not just the
      // summary line.
      const containing = rendered.foldRanges.filter(
        (r) => line >= r.start && line <= r.end,
      )
      if (containing.length > 0) {
        setCollapsedFolds((prev) => {
          const next = new Set(prev)
          let changed = false
          for (const r of containing) {
            if (next.delete(foldKey(r))) changed = true
          }
          return changed ? next : prev
        })
        requestAnimationFrame(() => {
          const el = container.querySelector(
            `[data-line="${line}"]`,
          ) as HTMLElement | null
          if (!el) return
          el.scrollIntoView({ block: 'center', behavior: 'auto' })
          if (flash) flashLine(el)
        })
        return
      }
      const el = container.querySelector(
        `[data-line="${line}"]`,
      ) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'auto' })
      if (flash) flashLine(el)
    }

    // Branch A: (file, screen) just changed.
    if (lastScrolledKey.current !== fileStageKey) {
      lastScrolledKey.current = fileStageKey

      // Highest priority: a pending pixel scroll target from goBack/
      // goForward — the user explicitly asked to land where they last
      // were. Defer one frame so the fold-seeding effect commits first
      // (collapsed folds shift line offsets above the saved position).
      if (pendingScrollTop != null) {
        const top = pendingScrollTop
        consumePendingScrollTop()
        requestAnimationFrame(() => {
          if (containerRef.current) containerRef.current.scrollTop = top
        })
        return
      }

      if (pendingNavigation && pendingNavigation.file === activeFile) {
        scrollToLine(pendingNavigation.line, true)
        consumePendingNavigation()
        return
      }
      const openTarget = screen?.open
      if (openTarget?.file === activeFile) {
        let line: number | null = null
        if (openTarget.id && rendered.marks[openTarget.id]) {
          line = rendered.marks[openTarget.id]
        } else if (openTarget.line) {
          line = openTarget.line
        }
        if (line) {
          scrollToLine(line, false)
          return
        }
      }
      container.scrollTop = 0
      return
    }

    // Branch B: same (file, screen), but a fresh pendingNavigation arrived
    // (same-file symbol click). Scroll to it without touching scrollTop on
    // re-runs after consumption.
    if (pendingNavigation && pendingNavigation.file === activeFile) {
      scrollToLine(pendingNavigation.line, true)
      consumePendingNavigation()
    }
  }, [
    rendered,
    activeFile,
    screen,
    pendingNavigation,
    consumePendingNavigation,
    pendingScrollTop,
    consumePendingScrollTop,
    fileStageKey,
  ])

  // Persist the current scrollTop per (screen, file) so goBack/goForward can
  // restore where the user was. Plain map mutation — never read reactively, so
  // no rerenders. Suppressed while a pendingScrollTop is in flight: the
  // synthetic scroll set in the rAF below would otherwise overwrite the very
  // value we just restored.
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!screen || !activeFile) return
    if (useAppStore.getState().pendingScrollTop != null) return
    saveScrollPosition(screen.id, activeFile, e.currentTarget.scrollTop)
  }

  // Click delegation for symbol jumps — one listener instead of N.
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    // Walk up to find the nearest .prezl-symbol or fold toggle.
    let node: HTMLElement | null = target
    while (node && node !== e.currentTarget) {
      if (node.classList.contains('prezl-symbol')) {
        const file = node.dataset.targetFile
        const line = Number(node.dataset.targetLine)
        if (file && Number.isFinite(line) && line > 0) {
          e.preventDefault()
          e.stopPropagation()
          navigateToFileLine(file, line)
        }
        return
      }
      node = node.parentElement
    }
  }

  if (!activeFile || !rendered) {
    return <EmptyEditorPane />
  }

  if (isBinaryFile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-sm text-app-muted">
        <span>Can't preview this file type</span>
        <span className="text-xs opacity-70">{activeFile}</span>
      </div>
    )
  }

  const focusLines = buildLineSet(rendered.focusRanges)
  const foldByStart = new Map<number, FoldRange>()
  for (const r of rendered.foldRanges) foldByStart.set(r.start, r)
  const totalLines = rendered.text.split('\n').length

  const containerStyle: CSSProperties = {
    fontSize: editorFontSize(uiScale),
  }

  return (
    <div
      ref={containerRef}
      className="code-view flex-1 overflow-auto"
      style={containerStyle}
      onClick={onClick}
      onScroll={onScroll}
    >
      <div className="code-view-inner" role="presentation">
        {Array.from({ length: totalLines }, (_, i) => {
          const lineNumber = i + 1
          if (isLineHidden(lineNumber, rendered.foldRanges, collapsedFolds)) {
            return null
          }
          const lineTokens = tokens?.[i] ?? null
          const lineText = lineTokens
            ? null
            : (rendered.text.split('\n')[i] ?? '')
          const fold = foldByStart.get(lineNumber)
          const collapsed = fold ? collapsedFolds.has(foldKey(fold)) : false
          const focused = focusLines.has(lineNumber)
          return (
            <div
              key={lineNumber}
              data-line={lineNumber}
              className={
                'code-line' +
                (focused ? ' code-line-focused' : '') +
                (fold ? ' code-line-foldable' : '')
              }
            >
              <span className="code-line-no" aria-hidden>
                {lineNumber}
              </span>
              <span className="code-fold-gutter">
                {fold ? (
                  <button
                    type="button"
                    className={
                      'code-fold-toggle' +
                      (collapsed
                        ? ' code-fold-collapsed'
                        : ' code-fold-expanded')
                    }
                    aria-label={collapsed ? 'Expand region' : 'Collapse region'}
                    aria-expanded={!collapsed}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFold(fold)
                    }}
                  />
                ) : null}
              </span>
              <span className="code-line-content">
                {lineTokens
                  ? renderTokens(
                      lineTokens,
                      lineNumber,
                      symbolTable,
                      activeFile,
                    )
                  : lineText}
                {fold && collapsed ? (
                  <span className="code-fold-summary">
                    {fold.label ?? '⋯'}
                  </span>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** A line is hidden if any *collapsed* fold contains it (and the line is not
 *  the fold's start line, which always stays visible as the header). */
function isLineHidden(
  lineNumber: number,
  ranges: FoldRange[],
  collapsed: Set<string>,
): boolean {
  for (const r of ranges) {
    if (
      collapsed.has(foldKey(r)) &&
      lineNumber > r.start &&
      lineNumber <= r.end
    ) {
      return true
    }
  }
  return false
}

function foldKey(r: { start: number; end: number }): string {
  return `${r.start}-${r.end}`
}

const FLASH_ANIM_ID = 'prezl-line-flash'

/** Brief background flash on a code line so the eye can locate the jump
 *  target. Imperative via the Web Animations API so React reconciliation
 *  can't clobber it, and so repeat jumps to the same line restart cleanly
 *  without needing key/remount tricks. */
function flashLine(el: HTMLElement) {
  for (const a of el.getAnimations()) {
    if (a.id === FLASH_ANIM_ID) a.cancel()
  }
  const accent =
    getComputedStyle(el).getPropertyValue('--color-app-accent').trim() ||
    '99 102 241'
  const anim = el.animate(
    [
      { backgroundColor: `rgba(${accent} / 0.5)`, offset: 0 },
      { backgroundColor: `rgba(${accent} / 0.5)`, offset: 0.4 },
      { backgroundColor: 'transparent', offset: 1 },
    ],
    { duration: 1600, easing: 'ease-out' },
  )
  anim.id = FLASH_ANIM_ID
}

function buildLineSet(
  ranges: RenderedFile['focusRanges'],
): Set<number> {
  const out = new Set<number>()
  for (const r of ranges) {
    for (let l = r.start; l <= r.end; l++) out.add(l)
  }
  return out
}

/** Walk a line's Shiki tokens and emit React nodes. Splits any token whose
 *  text contains a known symbol identifier so the matched word can be
 *  wrapped in a click-jumpable .prezl-symbol span. The definition site
 *  (where the symbol's id directive lives) is skipped — clicking it would
 *  jump in place. */
function renderTokens(
  lineTokens: ShikiToken[],
  lineNumber: number,
  symbolTable: SymbolTable,
  activeFile: string,
): ReactNode[] {
  const out: ReactNode[] = []
  let nodeKey = 0
  for (const token of lineTokens) {
    const style = tokenStyle(token)
    const content = token.content
    if (!hasAnySymbolMatch(content, symbolTable)) {
      out.push(
        <span key={nodeKey++} style={style}>
          {content}
        </span>,
      )
      continue
    }
    // Find every word-boundary identifier in the token; if it's a known symbol
    // (and not the definition site), wrap it.
    const wordRe = /\b[A-Za-z_]\w*\b/g
    let lastEnd = 0
    let m: RegExpExecArray | null
    while ((m = wordRe.exec(content)) !== null) {
      const id = m[0]
      const target = symbolTable.get(id)
      if (!target) continue
      if (target.file === activeFile && target.line === lineNumber) continue
      if (m.index > lastEnd) {
        out.push(
          <span key={nodeKey++} style={style}>
            {content.slice(lastEnd, m.index)}
          </span>,
        )
      }
      out.push(
        <span
          key={nodeKey++}
          style={style}
          className="prezl-symbol"
          data-target-file={target.file}
          data-target-line={target.line}
          title={`Click → ${target.file}:${target.line}`}
        >
          {id}
        </span>,
      )
      lastEnd = m.index + id.length
    }
    if (lastEnd === 0) {
      // No symbol matches in this token — emit it unchanged.
      out.push(
        <span key={nodeKey++} style={style}>
          {content}
        </span>,
      )
    } else if (lastEnd < content.length) {
      // Trailing piece after the last match.
      out.push(
        <span key={nodeKey++} style={style}>
          {content.slice(lastEnd)}
        </span>,
      )
    }
  }
  return out
}

function hasAnySymbolMatch(text: string, table: SymbolTable): boolean {
  if (table.size === 0) return false
  // Quick reject: token text contains no identifier characters.
  if (!/[A-Za-z_]/.test(text)) return false
  return true
}

const FONT_STYLE_ITALIC = 1
const FONT_STYLE_BOLD = 2
const FONT_STYLE_UNDERLINE = 4

function tokenStyle(token: ShikiToken): CSSProperties {
  const style: CSSProperties = {}
  if (token.color) style.color = token.color
  const fs = token.fontStyle ?? 0
  if (fs & FONT_STYLE_ITALIC) style.fontStyle = 'italic'
  if (fs & FONT_STYLE_BOLD) style.fontWeight = 'bold'
  if (fs & FONT_STYLE_UNDERLINE) style.textDecoration = 'underline'
  return style
}

/** Centered, low-contrast brand mark for the empty editor pane — shown
 *  when no file is open (project logo if set, otherwise the Prezl
 *  pretzel mark). Reads like a "title slide" for the project: brand
 *  mark, project name, and a small explorer hint. Visual breather, not
 *  an action target. */
function EmptyEditorPane() {
  const logoSrc = useProjectLogoSrc()
  const projectName = useAppStore((s) => s.project?.name ?? null)
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-app-surface text-center">
      {logoSrc ? (
        <img
          src={logoSrc}
          alt=""
          aria-hidden
          className="pointer-events-none h-32 w-32 object-contain opacity-20"
        />
      ) : (
        <PretzelLogo className="pointer-events-none h-32 w-32 text-app opacity-20" />
      )}
      {projectName && (
        <div className="text-2xl font-semibold text-app opacity-40">
          {projectName}
        </div>
      )}
      <div className="text-sm text-app-muted">
        Select a file from the explorer to begin
      </div>
    </div>
  )
}
