import Editor, { type OnMount } from '@monaco-editor/react'
import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/state/store'
import { editorFontSize } from '@/hooks/useUiScale'

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

export function CodeEditor() {
  const activeFile = useAppStore((s) => s.activeFile)
  const rawFiles = useAppStore((s) => s.rawFiles)
  const uiScale = useAppStore((s) => s.preferences.uiScale)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const content = activeFile ? (rawFiles.get(activeFile) ?? '') : ''
  const language = inferLanguage(activeFile)

  const onMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monaco.editor.defineTheme('prezl-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e22',
      },
    })
    monaco.editor.setTheme('prezl-dark')
  }, [])

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize: editorFontSize(uiScale) })
  }, [uiScale])

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
