import { inferLanguage, languageDisplayName } from '@/project/shikiSetup'
import { useAppStore } from '@/state/store'

export function StatusBar() {
  const stageLabel = useAppStore((s) => {
    if (!s.project || !s.currentStageAlias) return '—'
    const stage = s.project.stages.find((x) => x.alias === s.currentStageAlias)
    return stage?.branch ?? stage?.alias ?? '—'
  })
  const language = useAppStore((s) =>
    s.activeFile ? languageDisplayName(inferLanguage(s.activeFile)) : '—'
  )
  const statusMessage = useAppStore((s) => s.statusMessage)

  return (
    <footer className="flex h-6 items-center justify-between border-t border-app-border bg-app-surface px-3 text-[11px] text-app-muted">
      <div className="flex items-center gap-3">
        <span>⎇ {stageLabel}</span>
        <span>{language}</span>
      </div>
      <div>{statusMessage}</div>
    </footer>
  )
}
