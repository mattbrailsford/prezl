import { FolderOpen, X } from 'lucide-react'
import {
  useOpenProject,
  usePickAndOpenProject,
  useRecentProjects,
} from '@/hooks/useProjectLoader'
import { PretzelLogo } from './PretzelLogo'
import { WindowControls } from './WindowControls'

export function WelcomeScreen() {
  const pickAndOpen = usePickAndOpenProject()
  const openProject = useOpenProject()
  const { recents, forget } = useRecentProjects()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        data-tauri-drag-region
        className="flex h-12 shrink-0 items-center border-b border-app-border bg-app-surface pl-3"
      >
        <span data-tauri-drag-region className="flex items-center gap-2 text-base">
          <span
            data-tauri-drag-region
            aria-hidden
            className="grid size-7 place-items-center rounded bg-app-accent/20 text-app-accent"
          >
            <PretzelLogo className="pointer-events-none size-5" />
          </span>
          <span data-tauri-drag-region className="font-semibold text-app">
            Prezl
          </span>
        </span>
        <div data-tauri-drag-region className="flex-1 self-stretch" />
        <WindowControls />
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center bg-app p-10">
      <div className="flex w-full max-w-xl flex-col gap-8">
        <header className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded bg-app-accent/20 text-app-accent">
            <PretzelLogo className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-app">Prezl</h1>
            <p className="text-sm text-app-muted">
              Present code like slides
            </p>
          </div>
        </header>

        <button
          type="button"
          onClick={() => pickAndOpen()}
          className="flex items-center justify-center gap-2 rounded-md border border-app-border bg-app-panel px-4 py-3 text-base font-medium text-app hover:bg-app-border"
        >
          <FolderOpen className="size-5" />
          Open project folder…
        </button>

        {recents.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-muted">
              Recent projects
            </h2>
            <ul className="flex flex-col gap-1">
              {recents.map((r) => (
                <li
                  key={r.path}
                  className="group flex items-center gap-2 rounded border border-transparent bg-app-surface px-3 py-2 hover:border-app-border"
                >
                  <button
                    type="button"
                    onClick={() => openProject(r.path)}
                    className="flex flex-1 flex-col items-start text-left"
                  >
                    <span className="truncate text-sm font-medium text-app">
                      {r.name ?? pathBasename(r.path)}
                    </span>
                    <span className="truncate text-xs text-app-muted">
                      {r.path}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => forget(r.path)}
                    title="Remove from recents"
                    className="grid size-7 place-items-center rounded text-app-muted opacity-0 transition-opacity hover:bg-app-panel hover:text-app group-hover:opacity-100"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-app-muted">
          A project folder is any directory containing a{' '}
          <code className="rounded bg-app-panel px-1 py-0.5 text-xs">prezl.yaml</code>{' '}
          manifest.
        </p>
      </div>
      </main>
    </div>
  )
}

function pathBasename(p: string): string {
  const cleaned = p.replace(/[\\/]+$/, '')
  const idx = Math.max(cleaned.lastIndexOf('/'), cleaned.lastIndexOf('\\'))
  return idx < 0 ? cleaned : cleaned.slice(idx + 1)
}
