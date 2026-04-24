import { Presentation } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { BranchSelector } from './BranchSelector'
import { RunButton } from './RunButton'
import { WindowControls } from './WindowControls'

export function TopBar() {
  const projectName = useAppStore((s) => s.project?.project.name ?? 'Prezl')
  const clearProject = useAppStore((s) => s.clearProject)

  return (
    <header
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center gap-3 border-b border-app-border bg-app-surface pl-3"
    >
      <button
        type="button"
        onClick={clearProject}
        title="Close project — return to welcome screen"
        className="flex items-center gap-2 rounded px-1 py-1 text-base hover:bg-app-panel"
      >
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded bg-app-accent/20 text-app-accent"
        >
          <Presentation className="pointer-events-none size-5" />
        </span>
        <span className="font-semibold text-app">{projectName}</span>
      </button>
      <div
        data-tauri-drag-region
        className="h-6 w-px bg-app-border"
        aria-hidden
      />
      <BranchSelector />
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center justify-end gap-2 self-stretch pr-2"
      >
        <RunButton />
      </div>
      <WindowControls />
    </header>
  )
}
