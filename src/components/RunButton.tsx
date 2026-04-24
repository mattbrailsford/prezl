import { Loader2, Play, Square } from 'lucide-react'
import { useAppStore } from '@/state/store'

export function RunButton() {
  const currentBranch = useAppStore((s) =>
    s.project?.branches.find((b) => b.name === s.currentBranchName) ?? null,
  )
  const previewKind = useAppStore((s) => s.previewState.kind)
  const runPreview = useAppStore((s) => s.runPreview)
  const closePreview = useAppStore((s) => s.closePreview)
  const hasPreview = Boolean(currentBranch?.preview)

  // Launching: fake-build sequence in-flight; disabled with spinner.
  if (previewKind === 'launching') {
    return (
      <button
        type="button"
        disabled
        title="Launching preview…"
        className="inline-flex items-center gap-2 rounded border border-app-border bg-app-panel px-3 py-1 text-base text-app-muted opacity-70"
      >
        <Loader2 className="size-5 animate-spin" />
        <span>Run</span>
      </button>
    )
  }

  // Video modal is open — button becomes Stop.
  if (previewKind === 'video') {
    return (
      <button
        type="button"
        onClick={closePreview}
        title="Stop preview (Esc)"
        className="inline-flex items-center gap-2 rounded border border-red-500/60 bg-red-500/15 px-3 py-1 text-base text-red-400 hover:bg-red-500/25"
      >
        <Square className="size-5 fill-current" />
        <span>Stop</span>
      </button>
    )
  }

  // Idle.
  const disabled = !hasPreview
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => runPreview()}
      title={disabled ? 'No preview configured' : 'Run preview (Ctrl+Enter)'}
      className="inline-flex items-center gap-2 rounded border border-app-border bg-app-panel px-3 py-1 text-base text-app hover:bg-app-border disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Play className="size-5 fill-current" />
      <span>Run</span>
    </button>
  )
}
