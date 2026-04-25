import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useAppStore } from '@/state/store'
import { editorFontSize } from '@/hooks/useUiScale'
import {
  useActiveRenderedFile,
  useCurrentStage,
  useSymbolTable,
  type SymbolTarget,
} from '@/hooks/useRenderedFile'
import type { RenderedFile } from '@/project/directiveParser'
import {
  PREZL_THEME,
  prezlRegisterFolding,
  type PrezlMonaco,
} from '@/project/monacoSetup'

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
      return 'razor'
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'scss':
      return 'scss'
    case 'yml':
    case 'yaml':
      return 'yaml'
    case 'toml':
      return 'toml'
    case 'java':
      return 'java'
    case 'kt':
      return 'kotlin'
    case 'swift':
      return 'swift'
    case 'rb':
      return 'ruby'
    case 'php':
      return 'php'
    case 'go':
      return 'go'
    case 'c':
    case 'h':
      return 'c'
    case 'cpp':
    case 'hpp':
      return 'cpp'
    case 'sh':
    case 'bash':
      return 'shellscript'
    case 'sql':
      return 'sql'
    case 'xml':
      return 'xml'
    case 'vue':
      return 'vue'
    case 'svelte':
      return 'svelte'
    default:
      return 'plaintext'
  }
}

// Module-level registry: model URI -> fold ranges. A single folding range
// provider registered once at first mount consults this map, so updating the
// map + re-triggering Monaco's folding is enough to reflect stage changes.
const foldRangesByUri = new Map<string, RenderedFile['foldRanges']>()
let providersRegistered = false

// Monaco's FoldingController caches the last-computed FoldingModel and only
// invalidates on model content change. When we mutate foldRangesByUri in
// place (stage change without a URI change), Monaco otherwise serves stale
// ranges. Firing this emitter tells it our provider's output has changed.
type FoldingListener = (provider: Monaco.languages.FoldingRangeProvider) => void
class FoldingChangeEmitter {
  private listeners = new Set<FoldingListener>()
  event = (
    listener: FoldingListener,
  ): { dispose: () => void } => {
    this.listeners.add(listener)
    return { dispose: () => this.listeners.delete(listener) }
  }
  fire = (provider: Monaco.languages.FoldingRangeProvider) => {
    for (const l of this.listeners) l(provider)
  }
}
const foldChangeEmitter = new FoldingChangeEmitter()
let registeredProviderInstance: Monaco.languages.FoldingRangeProvider | null =
  null

function ensureFoldingProvider(monaco: typeof Monaco): void {
  if (providersRegistered) return
  providersRegistered = true

  const provider: Monaco.languages.FoldingRangeProvider = {
    onDidChange: foldChangeEmitter.event as Monaco.IEvent<
      Monaco.languages.FoldingRangeProvider
    >,
    provideFoldingRanges(model) {
      const ranges = foldRangesByUri.get(model.uri.toString())
      if (!ranges) return []
      // eslint-disable-next-line no-console
      console.log('[prezl fold] provider returning', model.uri.toString(), ranges)
      return ranges.map((r) => ({ start: r.start, end: r.end }))
    },
  }
  registeredProviderInstance = provider

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
  const stage = useCurrentStage()
  const rendered = useActiveRenderedFile()
  const symbolTable = useSymbolTable()
  const navigateToFileLine = useAppStore((s) => s.navigateToFileLine)
  const pendingNavigation = useAppStore((s) => s.pendingNavigation)
  const consumePendingNavigation = useAppStore((s) => s.consumePendingNavigation)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const focusDecorationsRef = useRef<string[]>([])
  const symbolDecorationsRef = useRef<string[]>([])
  // Per-editor-line range -> navigation target. Populated alongside the
  // symbol decorations so the onMouseDown handler can resolve a click into
  // a jump without re-scanning text.
  const symbolHitsRef = useRef<
    { lineNumber: number; startColumn: number; endColumn: number; target: SymbolTarget }[]
  >([])
  // Monaco mounts asynchronously via @monaco-editor/react. The fold-applying
  // effect can fire before onMount lands editorRef.current — we flag readiness
  // here so the effect re-runs after mount and actually gets to setLastFoldedKey.
  const [editorReady, setEditorReady] = useState(false)

  // Derived `ready`: true iff folds have been applied for the current
  // (file, stage) combination. When activeFile or the stage alias change,
  // `ready` flips back to false in the same render that feeds Monaco new
  // content — so visibility: hidden lands before Monaco gets a chance to
  // paint the expanded content.
  const fileStageKey = useMemo(
    () => `${activeFile ?? ''}::${stage?.alias ?? ''}`,
    [activeFile, stage?.alias],
  )
  const [lastFoldedKey, setLastFoldedKey] = useState<string | null>(null)
  const ready = fileStageKey === lastFoldedKey

  const content = rendered?.text ?? ''
  const language = inferLanguage(activeFile)

  const onMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    // Shiki registered our theme during initMonaco; just set it.
    monaco.editor.setTheme(PREZL_THEME)
    ensureFoldingProvider(monaco)

    // Disable Monaco's built-in shortcuts that collide with Prezl's global
    // bindings — otherwise Monaco's own symbol-picker / command-palette
    // widgets open under our modals and darken the entire screen.
    const CtrlCmd = monaco.KeyMod.CtrlCmd
    const Shift = monaco.KeyMod.Shift
    monaco.editor.addKeybindingRules([
      { keybinding: CtrlCmd | Shift | monaco.KeyCode.KeyO, command: null },
      { keybinding: CtrlCmd | monaco.KeyCode.KeyT, command: null },
      { keybinding: CtrlCmd | monaco.KeyCode.KeyP, command: null },
      { keybinding: CtrlCmd | Shift | monaco.KeyCode.KeyP, command: null },
    ])
    setEditorReady(true)

    // Click on a decorated symbol navigates to its mark. Plain click rather
    // than Ctrl+click — Monaco is read-only so placing a cursor does
    // nothing useful, and a presenter flow benefits from no-modifier jumps.
    editor.onMouseDown((e) => {
      // Ignore right clicks / middle clicks — only primary button navigates.
      if (e.event.rightButton || e.event.middleButton) return
      const position = e.target.position
      if (!position) return
      const hit = symbolHitsRef.current.find(
        (h) =>
          h.lineNumber === position.lineNumber &&
          position.column >= h.startColumn &&
          position.column <= h.endColumn,
      )
      if (!hit) return
      e.event.preventDefault()
      e.event.stopPropagation()
      navigateToFileLine(hit.target.file, hit.target.line)
    })
  }, [navigateToFileLine])

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize: editorFontSize(uiScale) })
  }, [uiScale])

  // Apply fold ranges + focus decorations + mark scrolling when the rendered
  // file or active file changes.
  useEffect(() => {
    if (!editorReady) return
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
    // Tell Monaco our provider has new output so it invalidates its cached
    // FoldingModel and re-queries us.
    if (registeredProviderInstance) foldChangeEmitter.fire(registeredProviderInstance)

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

    // Symbol decorations: underline each word-boundary occurrence of an id
    // in the current file and remember its target so Ctrl+click can jump.
    const symbolHits: typeof symbolHitsRef.current = []
    const symbolDecorations: Monaco.editor.IModelDeltaDecoration[] = []
    const lines = rendered.text.split('\n')
    for (const [id, target] of symbolTable) {
      if (id.length === 0) continue
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`\\b${escaped}\\b`, 'g')
      for (let li = 0; li < lines.length; li++) {
        const lineNumber = li + 1
        // Skip the definition site itself — clicking it would jump in place.
        if (target.file === activeFile && target.line === lineNumber) continue
        const text = lines[li]
        pattern.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = pattern.exec(text)) !== null) {
          const startColumn = m.index + 1
          const endColumn = m.index + id.length + 1
          symbolHits.push({ lineNumber, startColumn, endColumn, target })
          symbolDecorations.push({
            range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
            options: {
              inlineClassName: 'prezl-symbol',
              hoverMessage: {
                value: `Click → ${target.file}:${target.line}`,
              },
            },
          })
        }
      }
    }
    symbolDecorationsRef.current = editor.deltaDecorations(
      symbolDecorationsRef.current,
      symbolDecorations,
    )
    symbolHitsRef.current = symbolHits

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

      // One-shot navigation (symbol jump) takes priority over stage.open.
      if (pendingNavigation && pendingNavigation.file === activeFile) {
        editor.revealLineInCenter(pendingNavigation.line)
        editor.setPosition({ lineNumber: pendingNavigation.line, column: 1 })
        consumePendingNavigation()
        return
      }

      const openTarget = stage?.open
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
          requestAnimationFrame(() => {
            if (!cancelled) setLastFoldedKey(fileStageKey)
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    rendered,
    activeFile,
    stage,
    fileStageKey,
    editorReady,
    symbolTable,
    pendingNavigation,
    consumePendingNavigation,
  ])

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
        theme={PREZL_THEME}
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
