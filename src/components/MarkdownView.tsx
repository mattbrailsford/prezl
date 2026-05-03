import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Marked } from 'marked'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import { saveScrollPosition, useAppStore } from '@/state/store'
import { editorFontSize } from '@/hooks/useUiScale'
import { useCurrentScreen, useSymbolTable } from '@/hooks/useRenderedFile'
import { PREZL_THEME, getHighlighter } from '@/project/shikiSetup'
import type { RenderedFile } from '@/project/directiveParser'
import { parseTargetShorthand } from '@/project/schema'

/** Renders `.md` files as styled markdown. The `rendered.text` it consumes
 *  has already been through the directive parser, so `<!-- @prezl ... -->`
 *  comments are stripped and `show=` regions gated for the current screen.
 *
 *  GFM features (tables, task lists, strikethrough, autolinks) are on.
 *  Code fences upgrade to Shiki-highlighted HTML once the highlighter is
 *  ready. Anchor links are partitioned at layout time:
 *
 *  - `[text](path[#id][@line])` — prezl shorthand → click navigates via
 *    `navigateToFileLine`, with the line resolved from the symbol table
 *    when `#id` is given. Files already in `visitedFilesInStage` get the
 *    visited treatment (tick + muted).
 *  - `[text](#anchor)` — markdown heading anchor; native browser scroll.
 *  - `[text](http(s)://…)` / `mailto:` / `tel:` — opens externally via the
 *    Tauri shell plugin. */
export function MarkdownView({
  rendered,
  activeFile,
}: {
  rendered: RenderedFile
  activeFile: string
}) {
  const screen = useCurrentScreen()
  const symbolTable = useSymbolTable()
  const visitedFiles = useAppStore((s) => s.visitedFilesInStage)
  const navigateToFileLine = useAppStore((s) => s.navigateToFileLine)
  const openFile = useAppStore((s) => s.openFile)
  const runDemo = useAppStore((s) => s.runDemo)
  const demosById = useAppStore((s) => s.demosById)
  const projectFiles = useAppStore((s) => s.project?.files ?? EMPTY_FILES)
  const uiScale = useAppStore((s) => s.preferences.uiScale)
  const pendingScrollTop = useAppStore((s) => s.pendingScrollTop)
  const consumePendingScrollTop = useAppStore((s) => s.consumePendingScrollTop)

  const containerRef = useRef<HTMLDivElement>(null)

  // First pass: parse markdown synchronously. GFM + sane line-break behaviour
  // (no `breaks: true`, which would convert single newlines to <br>; that's a
  // CommonMark deviation we don't want).
  const baseHtml = useMemo(() => {
    const m = new Marked({ gfm: true, breaks: false })
    return m.parse(rendered.text, { async: false }) as string
  }, [rendered.text])

  // Second pass: upgrade code fences to Shiki output. Async because the
  // highlighter is lazy-loaded; the base HTML renders immediately and code
  // blocks just appear unstyled until tokens arrive (no flash, no blank).
  const [html, setHtml] = useState<string>(baseHtml)
  useEffect(() => {
    setHtml(baseHtml)
    let cancelled = false
    ;(async () => {
      const h = await getHighlighter()
      if (cancelled) return
      const doc = new DOMParser().parseFromString(
        `<div>${baseHtml}</div>`,
        'text/html',
      )
      const root = doc.body.firstElementChild as HTMLElement | null
      if (!root) return
      const codeBlocks = root.querySelectorAll('pre > code')
      let touched = false
      codeBlocks.forEach((codeEl) => {
        const lang = extractCodeLang(codeEl.className) ?? 'plaintext'
        const code = codeEl.textContent ?? ''
        try {
          const highlighted = h.codeToHtml(code, {
            lang,
            theme: PREZL_THEME,
          })
          const wrapper = doc.createElement('div')
          wrapper.innerHTML = highlighted
          const newPre = wrapper.firstElementChild
          if (newPre) {
            codeEl.parentElement!.replaceWith(newPre)
            touched = true
          }
        } catch {
          // unsupported language or grammar miss — leave the original
          // <pre><code> in place. Plain monospace is still readable.
        }
      })
      if (!cancelled && touched) setHtml(root.innerHTML)
    })().catch(() => {
      /* non-fatal — keep base HTML */
    })
    return () => {
      cancelled = true
    }
  }, [baseHtml])

  // Decorate links once the HTML is in the DOM. Re-runs when the visited set
  // or symbol table change so a freshly visited target gets ticked without a
  // full re-render of the document.
  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return
    const anchors = root.querySelectorAll('a[href]')
    const fileSet = new Set(projectFiles)
    anchors.forEach((node) => {
      const a = node as HTMLAnchorElement
      const href = a.getAttribute('href') ?? ''
      decorateAnchor(a, href, {
        fileSet,
        symbolTable,
        visitedFiles,
        demosById,
      })
    })
  }, [html, symbolTable, visitedFiles, projectFiles, demosById])

  // Scroll save/restore: matches CodeView's contract so goBack/goForward
  // round-trips through markdown views feel the same as code views.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (pendingScrollTop != null) {
      const top = pendingScrollTop
      consumePendingScrollTop()
      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollTop = top
      })
    } else {
      // Fresh open / file change: top.
      container.scrollTop = 0
    }
    // Re-run only when the file/screen changes, not on every visited tick.
  }, [activeFile, screen?.id, pendingScrollTop, consumePendingScrollTop])

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!screen || !activeFile) return
    if (useAppStore.getState().pendingScrollTop != null) return
    saveScrollPosition(screen.id, activeFile, e.currentTarget.scrollTop)
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    let node: HTMLElement | null = target
    while (node && node !== e.currentTarget) {
      if (node.tagName === 'A') {
        const a = node as HTMLAnchorElement
        const kind = a.dataset.prezlLinkKind
        if (kind === 'prezl') {
          const file = a.dataset.prezlTargetFile
          const lineRaw = a.dataset.prezlTargetLine
          if (file) {
            e.preventDefault()
            e.stopPropagation()
            const line = lineRaw ? Number(lineRaw) : NaN
            if (Number.isFinite(line) && line > 0) {
              navigateToFileLine(file, line)
            } else {
              openFile(file)
            }
          }
          return
        }
        if (kind === 'demo') {
          const id = a.dataset.prezlDemoId
          if (id) {
            const demo = demosById.get(id)
            if (demo) {
              e.preventDefault()
              e.stopPropagation()
              runDemo(demo).catch(() => {})
            }
          }
          return
        }
        if (kind === 'external') {
          e.preventDefault()
          e.stopPropagation()
          const href = a.getAttribute('href')
          if (href) openExternal(href).catch(() => {})
          return
        }
        // 'anchor' (in-document) and 'unresolved' fall through to default
        // browser behaviour.
        return
      }
      node = node.parentElement
    }
  }

  const containerStyle: CSSProperties = {
    fontSize: editorFontSize(uiScale),
  }

  return (
    <div
      ref={containerRef}
      className="prezl-md flex-1 overflow-auto px-10 py-8"
      style={containerStyle}
      onClick={onClick}
      onScroll={onScroll}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

const EMPTY_FILES: string[] = []

function extractCodeLang(className: string): string | null {
  const m = /\blanguage-([\w-]+)\b/.exec(className)
  return m ? m[1] : null
}

type DecorateContext = {
  fileSet: Set<string>
  symbolTable: Map<string, { file: string; line: number }>
  visitedFiles: Set<string>
  demosById: Map<string, unknown>
}

/** Tag the anchor with `data-prezl-link-kind` so the container's click
 *  handler can dispatch without re-parsing the href. Exported as a
 *  side-effect on the element rather than returning data so we can stamp
 *  visited state at the same time. */
function decorateAnchor(a: HTMLAnchorElement, href: string, ctx: DecorateContext) {
  if (!href) {
    a.dataset.prezlLinkKind = 'unresolved'
    return
  }
  // demo://<id> — project-wide demo trigger. Tag even when the id doesn't
  // resolve so the click handler can no-op cleanly; styling stays muted via
  // the kind attribute.
  if (/^demo:\/\//i.test(href)) {
    const id = href.slice('demo://'.length)
    a.dataset.prezlLinkKind = 'demo'
    a.dataset.prezlDemoId = id
    if (!ctx.demosById.has(id)) {
      a.dataset.prezlUnresolved = 'true'
    } else {
      delete a.dataset.prezlUnresolved
    }
    return
  }
  if (/^(?:https?|mailto|tel|ftp):/i.test(href)) {
    a.dataset.prezlLinkKind = 'external'
    a.setAttribute('rel', 'noopener noreferrer')
    return
  }
  if (href.startsWith('#')) {
    a.dataset.prezlLinkKind = 'anchor'
    return
  }
  const parsed = parseTargetShorthand(href)
  if (!parsed.file || !ctx.fileSet.has(parsed.file)) {
    // Path that doesn't resolve to a known project file. Leave it alone —
    // could be a relative URL the author wants the browser to handle, or
    // just a dead link. Either way, don't intercept.
    a.dataset.prezlLinkKind = 'unresolved'
    return
  }
  let line: number | null = null
  if (parsed.line != null) {
    line = parsed.line
  } else if (parsed.id != null) {
    const sym = ctx.symbolTable.get(parsed.id)
    if (sym && sym.file === parsed.file) line = sym.line
  }
  a.dataset.prezlLinkKind = 'prezl'
  a.dataset.prezlTargetFile = parsed.file
  if (line != null) {
    a.dataset.prezlTargetLine = String(line)
  } else {
    delete a.dataset.prezlTargetLine
  }
  if (ctx.visitedFiles.has(parsed.file)) {
    a.dataset.prezlVisited = 'true'
  } else {
    delete a.dataset.prezlVisited
  }
}
