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
import { convertProjectFileSrc } from '@/project/assetSrc'
import { markedImageAttrs } from '@/project/markedImageAttrs'

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
 *    when `#id` is given. Files already in `visitedFilesInOpen` (visits
 *    under the current open frame; resets when a step authors its own
 *    `open`, persists across consecutive steps that inherit the stage's
 *    open) get the visited treatment (tick + muted).
 *  - `[text](demo://<id>)` — runs the demo on click. Demos already in
 *    `launchedDemosInOpen` (same open-frame reset policy as
 *    `visitedFilesInOpen`) get the same tick + muted treatment, so
 *    presenters can see at a glance which demos they've already shown
 *    under the current intro framing.
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
  const visitedFiles = useAppStore((s) => s.visitedFilesInOpen)
  const launchedDemos = useAppStore((s) => s.launchedDemosInOpen)
  const navigateToFileLine = useAppStore((s) => s.navigateToFileLine)
  const openFile = useAppStore((s) => s.openFile)
  const runDemo = useAppStore((s) => s.runDemo)
  const demosById = useAppStore((s) => s.demosById)
  const projectFiles = useAppStore((s) => s.project?.files ?? EMPTY_FILES)
  const rootPath = useAppStore((s) => s.project?.rootPath ?? null)
  const uiScale = useAppStore((s) => s.preferences.uiScale)
  const pendingScrollTop = useAppStore((s) => s.pendingScrollTop)
  const consumePendingScrollTop = useAppStore((s) => s.consumePendingScrollTop)

  const containerRef = useRef<HTMLDivElement>(null)

  // First pass: parse markdown synchronously. GFM + sane line-break behaviour
  // (no `breaks: true`, which would convert single newlines to <br>; that's a
  // CommonMark deviation we don't want).
  const baseHtml = useMemo(() => {
    const m = new Marked({ gfm: true, breaks: false })
    m.use(markedImageAttrs)
    return m.parse(rendered.text, { async: false }) as string
  }, [rendered.text])

  // Image src rewriting needs to happen synchronously before mount so the
  // browser doesn't fire 404 fetches against the WebView's base URL for
  // `![...](./diagram.png)`-style paths. Resolved against the markdown
  // file's own directory under <rootPath>/files (natural markdown
  // convention); absolute, http(s), data:, and blob: srcs pass through
  // unchanged.
  const htmlWithImagesResolved = useMemo(() => {
    if (!rootPath || !baseHtml.includes('<img')) return baseHtml
    const doc = new DOMParser().parseFromString(
      `<div>${baseHtml}</div>`,
      'text/html',
    )
    const root = doc.body.firstElementChild as HTMLElement | null
    if (!root) return baseHtml
    const imgs = root.querySelectorAll('img[src]')
    let touched = false
    imgs.forEach((node) => {
      const img = node as HTMLImageElement
      const src = img.getAttribute('src') ?? ''
      const resolved = resolveImageSrc(src, activeFile, rootPath)
      if (resolved !== src) {
        img.setAttribute('src', resolved)
        touched = true
      }
    })
    return touched ? root.innerHTML : baseHtml
  }, [baseHtml, activeFile, rootPath])

  // Second pass: upgrade code fences to Shiki output. Async because the
  // highlighter is lazy-loaded; the base HTML renders immediately and code
  // blocks just appear unstyled until tokens arrive (no flash, no blank).
  const [html, setHtml] = useState<string>(htmlWithImagesResolved)
  useEffect(() => {
    setHtml(htmlWithImagesResolved)
    let cancelled = false
    ;(async () => {
      const h = await getHighlighter()
      if (cancelled) return
      const doc = new DOMParser().parseFromString(
        `<div>${htmlWithImagesResolved}</div>`,
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
  }, [htmlWithImagesResolved])

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
        launchedDemos,
      })
    })
  }, [html, symbolTable, visitedFiles, projectFiles, demosById, launchedDemos])

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

/** Resolve an `<img src>` from rendered markdown into something the WebView
 *  can fetch. Relative paths join against the markdown file's own directory
 *  (so `![](./diagram.png)` next to `intro.md` works the way it does on
 *  GitHub); paths starting with `/` are project-root-relative (where
 *  `prezl.yaml` lives), matching the convention videos and the project
 *  logo already use for presentation assets that sit outside `files/`.
 *  URLs with a scheme (http, https, data, blob, file) and protocol-
 *  relative forms pass through untouched.
 *
 *  `..` can walk out of `files/` into rootPath — handy when the author
 *  keeps presentation assets next to `prezl.yaml` and intros under
 *  `files/.prezl/`. Anything past rootPath (more `..`s than depth) is
 *  refused; the original src is returned so the browser surfaces the
 *  broken-image affordance instead of us silently hitting an unrelated
 *  filesystem location. */
function resolveImageSrc(
  src: string,
  activeFile: string,
  rootPath: string,
): string {
  if (!src) return src
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return src
  if (src.startsWith('//')) return src

  let combined: string
  if (src.startsWith('/')) {
    combined = `${rootPath}/${src.slice(1)}`
  } else {
    const dir = activeFile.includes('/')
      ? activeFile.slice(0, activeFile.lastIndexOf('/'))
      : ''
    const fromMd = dir ? `${dir}/${src}` : src
    combined = `${rootPath}/files/${fromMd}`
  }
  const normalized = normaliseAbsolutePath(combined, rootPath)
  if (normalized == null) return src
  return convertProjectFileSrc(normalized)
}

/** Collapse `.` and `..` segments in an absolute (already-prefixed-with-
 *  rootPath) forward-slash path, refusing to walk above rootPath. Returns
 *  the cleaned path on success, `null` on escape. */
function normaliseAbsolutePath(path: string, rootPath: string): string | null {
  // Split rootPath off the front so we can normalise the remaining
  // suffix against a counter that won't underflow into the host
  // filesystem (drive letters, etc.).
  if (!path.startsWith(rootPath + '/')) return null
  const suffix = path.slice(rootPath.length + 1)
  const out: string[] = []
  for (const seg of suffix.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length === 0) return null
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.length ? `${rootPath}/${out.join('/')}` : rootPath
}

type DecorateContext = {
  fileSet: Set<string>
  symbolTable: Map<string, { file: string; line: number }>
  visitedFiles: Set<string>
  demosById: Map<string, unknown>
  launchedDemos: Set<string>
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
    if (ctx.launchedDemos.has(id)) {
      a.dataset.prezlVisited = 'true'
    } else {
      delete a.dataset.prezlVisited
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
