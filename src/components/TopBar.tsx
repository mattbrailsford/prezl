import { useMemo } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useAppStore } from '@/state/store'
import { StageSelector } from './StageSelector'
import { StepIndicator } from './StepIndicator'
import { PretzelLogo } from './PretzelLogo'
import { RunButton } from './RunButton'
import { WindowControls } from './WindowControls'
import { BackToPresentationButton } from './BackToPresentationButton'

export function TopBar() {
  const projectName = useAppStore((s) => s.project?.name ?? 'Prezl')
  const logo = useAppStore((s) => s.project?.logo)
  const rootPath = useAppStore((s) => s.project?.rootPath ?? null)
  const clearProject = useAppStore((s) => s.clearProject)

  const logoSrc = useMemo(() => {
    if (!logo || !rootPath) return null
    if (/^https?:\/\//i.test(logo)) return logo
    const cleaned = logo.replace(/^\.\//, '')
    const absolute = cleaned.startsWith('/') || /^[A-Za-z]:[\\/]/.test(cleaned)
      ? cleaned
      : `${rootPath}/${cleaned}`
    return convertFileSrc(absolute)
  }, [logo, rootPath])

  return (
    <header
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center gap-3 border-b border-app-border bg-app-surface pl-2"
    >
      <button
        type="button"
        onClick={clearProject}
        title="Close project — return to welcome screen"
        className="flex items-center gap-2 rounded px-1 py-1 text-base hover:bg-app-panel"
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            aria-hidden
            className="pointer-events-none size-7 object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded bg-app-accent/20 text-app-accent"
          >
            <PretzelLogo className="pointer-events-none size-5" />
          </span>
        )}
        <span className="font-semibold text-app">{projectName}</span>
      </button>
      <div
        data-tauri-drag-region
        className="h-6 w-px bg-app-border"
        aria-hidden
      />
      <StageSelector />
      <StepIndicator />
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center justify-end gap-2 self-stretch pr-2"
      >
        <RunButton />
        <BackToPresentationButton />
      </div>
      <WindowControls />
    </header>
  )
}
