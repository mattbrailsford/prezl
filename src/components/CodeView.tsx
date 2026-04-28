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

  // Collapsed fold state, keyed by `${start}-${end}` per fold range.
  // Re-seeded from rendered.foldRanges on every (file, screen) change so
  // directive-driven defaults reapply at every screen boundary. Presenter
  // manual *expansions* (recorded in manuallyExpandedRef) persist across
  // step transitions within the same (file, stage) — opening a default-
  // collapsed fold mid-explanation shouldn't get re-collapsed by the next
  // step advance. Crossing into a different stage or swapping files
  // clears the manual overrides: stage moves are deliberate re-grounding
  // (especially `reset: true`), and a different file is its own context.
  // Symbol-jump auto-expansion (the scrollToLine path) deliberately does
  // NOT update manuallyExpandedRef — it's transient navigation; the next
  // step re-collapses per directive defaults.
  //
  // Note the two key shapes: `collapsedFolds` uses rendered line numbers
  // (because that's what the renderer/isLineHidden operate on), but
  // `manuallyExpandedRef` uses original-source line numbers via
  // `originalLineMap`. A `show=` region inside or above a fold shifts the
  // fold's rendered start/end across step transitions; the original-source
  // numbers don't, so the manual override survives the shift.
  const fileScreenKey = `${activeFile ?? ''}::${screen?.id ?? ''}`
  const fileStageKey = `${activeFile ?? ''}::${screen?.stageAlias ?? ''}`
  const [collapsedFolds, setCollapsedFolds] = useState<Set<string>>(new Set())
  const lastSeededScreenKey = useRef<string | null>(null)
  const lastStageKey = useRef<string | null>(null)
  const manuallyExpandedRef = useRef<Set<string>>(new Set())

  useLayoutEffect(() => {
    if (!rendered) return
    if (lastSeededScreenKey.current === fileScreenKey) return
    if (lastStageKey.current !== fileStageKey) {
      manuallyExpandedRef.current = new Set()
      lastStageKey.current = fileStageKey
    }
    lastSeededScreenKey.current = fileScreenKey
    const initial = new Set<string>()
    for (const r of rendered.foldRanges) {
      if (!manuallyExpandedRef.current.has(manualKey(r, rendered.originalLineMap))) {
        initial.add(foldKey(r))
      }
    }
    setCollapsedFolds(initial)
  }, [rendered, fileScreenKey, fileStageKey])

  const toggleFold = (range: FoldRange) => {
    if (!rendered) return
    const key = foldKey(range)
    const mKey = manualKey(range, rendered.originalLineMap)
    setCollapsedFolds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        manuallyExpandedRef.current.add(mKey)
      } else {
        next.add(key)
        manuallyExpandedRef.current.delete(mKey)
      }
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
  //   3. screen.open's resolved line/id
  //   4. preserve current scrollTop when the file is unchanged from the
  //      previous screen (so step advances through the same file don't
  //      jump-to-top when the new screen has no scroll opinion)
  //   5. top of file (cross-file with no opinion)
  //
  // Branch B — fires when a same-file pendingNavigation arrives and the
  //   (file, screen) hasn't changed (clicking a symbol that lives in the
  //   currently-open file). It scrolls to the target line and consumes the
  //   pending nav without resetting scrollTop afterwards.
  const lastScrolledKey = useRef<string | null>(null)
  const lastScrolledFile = useRef<string | null>(null)
  const scrollAnimRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!rendered || !containerRef.current) return
    const container = containerRef.current

    // `flash=true` is only for explicit user jumps (symbol click → a
    // pendingNavigation). The screen.open path runs on every screen/file
    // change and would flash distractingly on each step advance.
    const cancelScrollAnim = () => {
      if (scrollAnimRef.current != null) {
        cancelAnimationFrame(scrollAnimRef.current)
        scrollAnimRef.current = null
      }
    }

    // ~180ms easeOutCubic — snappy enough to feel instant on quick step
    // advances but smooth enough to track the eye to the new focus point.
    const animateScrollTop = (target: number) => {
      cancelScrollAnim()
      const start = container.scrollTop
      const distance = target - start
      if (Math.abs(distance) < 1) {
        container.scrollTop = target
        return
      }
      const duration = 180
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        container.scrollTop = start + distance * eased
        if (t < 1) {
          scrollAnimRef.current = requestAnimationFrame(tick)
        } else {
          scrollAnimRef.current = null
        }
      }
      scrollAnimRef.current = requestAnimationFrame(tick)
    }

    // Don't move if the line is already within a comfortable band
    // (10%–75% of the viewport); otherwise park it ~15% from the top
    // so there's room to read what comes after.
    const reveal = (el: HTMLElement) => {
      const elRect = el.getBoundingClientRect()
      const cRect = container.getBoundingClientRect()
      const relativeTop = elRect.top - cRect.top
      const h = container.clientHeight
      const inBand = relativeTop >= h * 0.1 && relativeTop + elRect.height <= h * 0.75
      if (inBand) return
      animateScrollTop(container.scrollTop + relativeTop - h * 0.15)
    }

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
      // The `flash` flag also distinguishes intent for fold-persistence:
      // flash=true is a transient user jump (symbol click) — auto-expand
      // is per-screen only. flash=false is the screen.open path (the
      // authored step intent), so containing folds get recorded in
      // manuallyExpandedRef and stay open across subsequent step
      // transitions within this (file, stage).
      const containing = rendered.foldRanges.filter(
        (r) => line >= r.start && line <= r.end,
      )
      if (containing.length > 0) {
        setCollapsedFolds((prev) => {
          const next = new Set(prev)
          let changed = false
          for (const r of containing) {
            const key = foldKey(r)
            if (next.delete(key)) {
              changed = true
              if (!flash) {
                manuallyExpandedRef.current.add(
                  manualKey(r, rendered.originalLineMap),
                )
              }
            }
          }
          return changed ? next : prev
        })
        requestAnimationFrame(() => {
          const el = container.querySelector(
            `[data-line="${line}"]`,
          ) as HTMLElement | null
          if (!el) return
          reveal(el)
          if (flash) flashLine(el)
        })
        return
      }
      const el = container.querySelector(
        `[data-line="${line}"]`,
      ) as HTMLElement | null
      if (!el) return
      reveal(el)
      if (flash) flashLine(el)
    }

    // Branch A: (file, screen) just changed.
    if (lastScrolledKey.current !== fileScreenKey) {
      const prevFile = lastScrolledFile.current
      lastScrolledKey.current = fileScreenKey
      lastScrolledFile.current = activeFile

      // Highest priority: a pending pixel scroll target from goBack/
      // goForward — the user explicitly asked to land where they last
      // were. Defer one frame so the fold-seeding effect commits first
      // (collapsed folds shift line offsets above the saved position).
      if (pendingScrollTop != null) {
        const top = pendingScrollTop
        consumePendingScrollTop()
        cancelScrollAnim()
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
      if (openTarget) {
        // Partial opens (no `file`) target the currently active file, so
        // a stage-level `open: { id }` or any partial that the resolver
        // couldn't fill in still scrolls correctly.
        const targetFile = openTarget.file ?? activeFile
        if (targetFile != null && targetFile === activeFile) {
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
      }
      // Same file across the screen change with no specific scroll target:
      // leave scrollTop alone. Step advances through one file (the most
      // common case for a stage with `steps:`) shouldn't snap the audience
      // back to the top when the new step has nothing to say about scroll.
      if (prevFile != null && prevFile === activeFile) {
        return
      }
      cancelScrollAnim()
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
    fileScreenKey,
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
  const commentSyntax = commentSyntaxFor(language)

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
          const hidden = isLineHidden(
            lineNumber,
            rendered.foldRanges,
            collapsedFolds,
          )
          const fold = foldByStart.get(lineNumber)
          const collapsed = fold ? collapsedFolds.has(foldKey(fold)) : false

          // Labeled collapsed fold: hide the entire [start, end] block and
          // stand a comment-styled placeholder in for it. Unlabeled folds
          // keep the existing inline `⋯` summary on the start line.
          // `!hidden` keeps a labeled fold nested inside another collapsed
          // fold from leaking through its parent's hidden body.
          if (fold && collapsed && fold.label && !hidden) {
            return (
              <FoldPlaceholderLine
                key={lineNumber}
                lineNumber={lineNumber}
                fold={fold}
                comment={commentSyntax}
                onToggle={() => toggleFold(fold)}
              />
            )
          }

          if (hidden) return null

          const lineTokens = tokens?.[i] ?? null
          const lineText = lineTokens
            ? null
            : (rendered.text.split('\n')[i] ?? '')
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
                  <span className="code-fold-summary">⋯</span>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type CommentSyntax = { open: string; close: string }

/** Comment shape used for labeled-collapse placeholders. The viewer renders
 *  these as decorative pseudo-code, so the syntax just needs to read like a
 *  comment in the active language — it doesn't have to round-trip through
 *  `detectDirective`. */
function commentSyntaxFor(lang: string): CommentSyntax {
  switch (lang) {
    case 'typescript':
    case 'javascript':
    case 'jsx':
    case 'tsx':
    case 'csharp':
    case 'rust':
    case 'go':
    case 'java':
    case 'kotlin':
    case 'swift':
    case 'php':
    case 'scss':
      return { open: '//', close: '' }
    case 'css':
    case 'c':
    case 'cpp':
      return { open: '/*', close: ' */' }
    case 'python':
    case 'ruby':
    case 'shellscript':
    case 'yaml':
    case 'toml':
      return { open: '#', close: '' }
    case 'sql':
      return { open: '--', close: '' }
    case 'html':
    case 'xml':
    case 'vue':
    case 'svelte':
    case 'markdown':
      return { open: '<!--', close: ' -->' }
    case 'razor':
      return { open: '@*', close: ' *@' }
    default:
      return { open: '//', close: '' }
  }
}

function FoldPlaceholderLine({
  lineNumber,
  fold,
  comment,
  onToggle,
}: {
  lineNumber: number
  fold: FoldRange
  comment: CommentSyntax
  onToggle: () => void
}) {
  const body = `${comment.open} ${fold.label}${comment.close}`
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle()
  }
  return (
    <div
      data-line={lineNumber}
      className="code-line code-line-foldable code-line-fold-placeholder"
      onClick={handleToggle}
      role="button"
      tabIndex={-1}
      aria-label={`Expand region: ${fold.label}`}
    >
      <span className="code-line-no" aria-hidden>
        {lineNumber}
      </span>
      <span className="code-fold-gutter">
        <button
          type="button"
          className="code-fold-toggle code-fold-collapsed"
          aria-label="Expand region"
          aria-expanded={false}
          onClick={handleToggle}
        />
      </span>
      <span className="code-line-content code-fold-placeholder">
        {fold.indent}
        {body}
      </span>
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

/** Stable key for `manuallyExpandedRef`, in original-source line numbers.
 *  Folds carry rendered line numbers, which shift when a `show=` region
 *  appears or disappears between steps. The original source positions
 *  don't, so a presenter-opened fold stays recognized even when its
 *  rendered range moves. */
function manualKey(
  r: { start: number; end: number },
  originalLineMap: number[],
): string {
  const os = originalLineMap[r.start - 1] ?? r.start
  const oe = originalLineMap[r.end - 1] ?? r.end
  return `${os}-${oe}`
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
