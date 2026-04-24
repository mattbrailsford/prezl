import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useAppStore } from '@/state/store'
import { editorFontSize } from '@/hooks/useUiScale'
import {
  useActiveRenderedFile,
  useCurrentBranch,
} from '@/hooks/useRenderedFile'
import type { RenderedFile } from '@/project/directiveParser'
import { prezlRegisterFolding, type PrezlMonaco } from '@/project/monacoSetup'

function inferLanguage(path: string | null): string {
  if (!path) return 'plaintext'
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'cs':
      return 'csharp'
    case 'json':
      return 'json'
    case 'md':
      return 'markdown'
    case 'rs':
      return 'rust'
    case 'py':
      return 'python'
    case 'razor':
    case 'cshtml':
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'yml':
    case 'yaml':
      return 'yaml'
    default:
      return 'plaintext'
  }
}

// Module-level registry: model URI -> fold ranges. A single folding range
// provider registered once at first mount consults this map, so updating the
// map + re-triggering Monaco's folding is enough to reflect stage changes.
const foldRangesByUri = new Map<string, RenderedFile['foldRanges']>()
let providersRegistered = false

function ensureFoldingProvider(monaco: typeof Monaco): void {
  if (providersRegistered) return
  providersRegistered = true

  const provider: Monaco.languages.FoldingRangeProvider = {
    provideFoldingRanges(model) {
      const ranges = foldRangesByUri.get(model.uri.toString())
      if (!ranges) return []
      return ranges.map((r) => ({ start: r.start, end: r.end }))
    },
  }

  // main.tsx already patched the global registerFoldingRangeProvider to a
  // no-op, so the TS language service can't add its own. We use the stashed
  // original to register our provider.
  const register = prezlRegisterFolding(monaco as PrezlMonaco)
  for (const lang of monaco.languages.getLanguages()) {
    register(lang.id, provider)
  }
}

export function CodeEditor() {
  const activeFile = useAppStore((s) => s.activeFile)
  const uiScale = useAppStore((s) => s.preferences.uiScale)
  const branch = useCurrentBranch()
  const rendered = useActiveRenderedFile()
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const focusDecorationsRef = useRef<string[]>([])
  // Monaco mounts asynchronously via @monaco-editor/react. The fold-applying
  // effect can fire before onMount lands editorRef.current — we flag readiness
  // here so the effect re-runs after mount and actually gets to setLastFoldedKey.
  const [editorReady, setEditorReady] = useState(false)

  // Derived `ready`: true iff folds have been applied for the current
  // (file, stage) combination. When activeFile or the branch alias change,
  // `ready` flips back to false in the same render that feeds Monaco new
  // content — so visibility: hidden lands before Monaco gets a chance to
  // paint the expanded content.
  const fileStageKey = useMemo(
    () => `${activeFile ?? ''}::${branch?.alias ?? ''}`,
    [activeFile, branch?.alias],
  )
  const [lastFoldedKey, setLastFoldedKey] = useState<string | null>(null)
  const ready = fileStageKey === lastFoldedKey

  const content = rendered?.text ?? ''
  const language = inferLanguage(activeFile)

  const onMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    monaco.editor.defineTheme('prezl-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e22',
      },
    })
    monaco.editor.setTheme('prezl-dark')
    ensureFoldingProvider(monaco)
    setEditorReady(true)
  }, [])

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize: editorFontSize(uiScale) })
  }, [uiScale])

  // Apply fold ranges + focus decorations + mark scrolling when the rendered
  // file or active file changes.
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco || !rendered || !activeFile) {
      focusDecorationsRef.current = []
      return
    }
    const model = editor.getModel()
    if (!model) return

    const uri = model.uri.toString()
    foldRangesByUri.set(uri, rendered.foldRanges)

    // Focus decorations.
    const newDecorations = rendered.focusRanges.map<Monaco.editor.IModelDeltaDecoration>(
      (r) => ({
        range: new monaco.Range(r.start, 1, r.end, Number.MAX_SAFE_INTEGER),
        options: {
          isWholeLine: true,
          className: 'prezl-focus-line',
          linesDecorationsClassName: 'prezl-focus-gutter',
        },
      }),
    )
    focusDecorationsRef.current = editor.deltaDecorations(
      focusDecorationsRef.current,
      newDecorations,
    )

    let cancelled = false
    const applyFoldsAndScroll = async () => {
      // Monaco's folding controller exposes an async getFoldingModel() that
      // resolves once it has consulted our provider and built the region tree
      // for the current model. Waiting on that is much more reliable than
      // guessing via requestAnimationFrame.
      type FoldingRegion = {
        regionIndex: number
        startLineNumber: number
        isCollapsed: boolean
      }
      type FoldingModelLike = {
        getRegionAtLine(line: number): FoldingRegion | null
        toggleCollapseState(regions: FoldingRegion[]): void
      }
      type FoldingControllerLike = {
        getFoldingModel?: () => Promise<FoldingModelLike | null>
      }
      const controller = editor.getContribution(
        'editor.contrib.folding',
      ) as unknown as FoldingControllerLike | null
      const foldingModel = await controller?.getFoldingModel?.()
      if (cancelled) return

      if (foldingModel) {
        const toCollapse: FoldingRegion[] = []
        for (const range of rendered.foldRanges) {
          const region = foldingModel.getRegionAtLine(range.start)
          if (region && !region.isCollapsed) toCollapse.push(region)
        }
        if (toCollapse.length > 0) foldingModel.toggleCollapseState(toCollapse)
      }

      const openTarget = branch?.open
      if (openTarget?.file === activeFile) {
        let line: number | null = null
        if (openTarget.id && rendered.marks[openTarget.id]) {
          line = rendered.marks[openTarget.id]
        } else if (openTarget.line) {
          line = openTarget.line
        }
        if (line) {
          editor.revealLineInCenter(line)
          editor.setPosition({ lineNumber: line, column: 1 })
          return
        }
      }
      editor.setPosition({ lineNumber: 1, column: 1 })
      editor.revealLine(1)
    }

    applyFoldsAndScroll()
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        if (!cancelled) {
          // One rAF after the fold commit so Monaco paints the collapsed
          // state in the same frame we reveal the host.
          requestAnimationFrame(() => {
            if (!cancelled) setLastFoldedKey(fileStageKey)
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [rendered, activeFile, branch, fileStageKey, editorReady])

  if (!activeFile) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-app-muted">
        Open a file from the explorer
      </div>
    )
  }

  return (
    <div
      className="monaco-host relative flex-1"
      style={{ visibility: ready ? 'visible' : 'hidden' }}
    >
      <Editor
        height="100%"
        path={activeFile}
        language={language}
        value={content}
        theme="prezl-dark"
        onMount={onMount}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          lineNumbers: 'on',
          glyphMargin: false,
          folding: true,
          showFoldingControls: 'always',
          renderLineHighlight: 'line',
          fontSize: editorFontSize(uiScale),
          fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          contextmenu: false,
          quickSuggestions: false,
          occurrencesHighlight: 'off',
          selectionHighlight: false,
          hover: { enabled: false },
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          wordBasedSuggestions: 'off',
          codeLens: false,
          links: false,
          inlayHints: { enabled: 'off' },
          renderValidationDecorations: 'off',
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  )
}
