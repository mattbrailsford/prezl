import { AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '@/state/store'

export function LoadErrorOverlay() {
  const loadError = useAppStore((s) => s.loadError)
  const setLoadError = useAppStore((s) => s.setLoadError)

  if (!loadError) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6">
      <div className="flex w-full max-w-xl flex-col gap-4 rounded-md border border-app-border bg-app-surface p-6">
        <header className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded bg-amber-500/20 text-amber-400">
            <AlertTriangle className="size-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-app">
              {headline(loadError.kind)}
            </h2>
            <p className="mt-1 break-words text-sm text-app-muted">
              {loadError.message}
              {loadError.line != null ? (
                <span className="text-app-muted">
                  {' '}
                  (line {loadError.line}
                  {loadError.column != null ? `, col ${loadError.column}` : ''})
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            aria-label="Dismiss"
            className="grid size-7 place-items-center rounded text-app-muted hover:bg-app-panel hover:text-app"
          >
            <X className="size-4" />
          </button>
        </header>
        {loadError.issues && loadError.issues.length > 0 && (
          <ul className="flex flex-col gap-1 rounded border border-app-border bg-app-panel p-3 text-sm">
            {loadError.issues.map((i, idx) => (
              <li key={idx} className="font-mono text-sm text-app">
                <span className="text-app-muted">{i.path || '(root)'}</span>
                {' — '}
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function headline(kind: 'parse' | 'validation' | 'io'): string {
  switch (kind) {
    case 'parse':
      return 'Could not parse prezl.yaml'
    case 'validation':
      return 'prezl.yaml is not valid'
    case 'io':
      return 'Could not read project'
  }
}
