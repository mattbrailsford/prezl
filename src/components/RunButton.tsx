import { Play } from 'lucide-react'
import { useAppStore } from '@/state/store'

export function RunButton() {
  const currentBranch = useAppStore((s) =>
    s.project?.branches.find((b) => b.name === s.currentBranchName) ?? null,
  )
  const hasPreview = Boolean(currentBranch?.preview)

  return (
    <button
      type="button"
      disabled={!hasPreview}
      title={hasPreview ? 'Run preview (Ctrl+Enter)' : 'No preview configured'}
      className="inline-flex items-center gap-2 rounded border border-app-border bg-app-panel px-3 py-1 text-base text-app hover:bg-app-border disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Play className="size-5 fill-current" />
      <span>Run</span>
    </button>
  )
}
