import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/state/store'
import { editorFontSize } from '@/hooks/useUiScale'
import {
  useActiveRenderedFile,
  useCurrentBranch,
} from '@/hooks/useRenderedFile'
import type { RenderedFile } from '@/project/directiveParser'

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
  for (const lang of monaco.languages.getLanguages()) {
    monaco.languages.registerFoldingRangeProvider(lang.id, provider)
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
  const rafRef = useRef<number | null>(null)

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

    // Fold ranges + restore cursor. Monaco's folding controller needs a beat
    // after model content updates before it consults our provider, so we wait
    // across two animation frames before firing the fold action. The first
    // rAF lets React commit; the second gives Monaco's async folding compute
    // a chance to land.
    let cancelled = false
    const applyFolds = () => {
      if (cancelled) return
      for (const range of rendered.foldRanges) {
        editor.setSelection(new monaco.Range(range.start, 1, range.start, 1))
        editor.getAction('editor.fold')?.run()
      }
      // Restore cursor to the file's intended open line.
      const openTarget = branch?.open
      if (openTarget?.file === activeFile) {
        let line: number | null = null
        if (openTarget.mark && rendered.marks[openTarget.mark]) {
          line = rendered.marks[openTarget.mark]
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
    const frame1 = requestAnimationFrame(() => {
      const frame2 = requestAnimationFrame(applyFolds)
      // Save so we can cancel if the effect tears down mid-frame.
      rafRef.current = frame2
    })
    rafRef.current = frame1
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [rendered, activeFile, branch])

  if (!activeFile) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-app-muted">
        Open a file from the explorer
      </div>
    )
  }

  return (
    <div className="monaco-host flex-1">
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
