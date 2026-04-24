import { useAppStore } from '@/state/store'

export function StatusBar() {
  const currentBranchName = useAppStore((s) => s.currentBranchName)
  const language = useAppStore((s) => s.project?.language ?? '—')
  const statusMessage = useAppStore((s) => s.statusMessage)

  return (
    <footer className="flex h-6 items-center justify-between border-t border-app-border bg-app-surface px-3 text-[11px] text-app-muted">
      <div className="flex items-center gap-3">
        <span>⎇ {currentBranchName ?? '—'}</span>
        <span>{language}</span>
      </div>
      <div>{statusMessage}</div>
    </footer>
  )
}
