import { Settings } from 'lucide-react'
import { inferLanguage, languageDisplayName } from '@/project/shikiSetup'
import { useAppStore } from '@/state/store'
import { useCurrentStage } from '@/hooks/useRenderedFile'
import { StatusBarLinkControls } from './StatusBarLinkControls'

export function StatusBar() {
  const stage = useCurrentStage()
  const stageLabel = stage?.branch ?? stage?.id ?? '—'
  const language = useAppStore((s) =>
    s.activeFile ? languageDisplayName(inferLanguage(s.activeFile)) : '—'
  )
  const statusMessage = useAppStore((s) => s.statusMessage)
  const openSettings = useAppStore((s) => s.openSettings)

  return (
    <footer className="flex h-6 items-center justify-between border-t border-app-border bg-app-surface px-3 text-xs text-app-muted">
      <div className="flex items-center gap-3">
        <span>⎇ {stageLabel}</span>
        <span>{language}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{statusMessage}</span>
        <StatusBarLinkControls />
        <button
          type="button"
          onClick={openSettings}
          title="Settings"
          aria-label="Settings"
          className="grid size-6 place-items-center rounded text-app-muted hover:bg-app-panel hover:text-app"
        >
          <Settings className="size-3.5" />
        </button>
      </div>
    </footer>
  )
}
