import { Loader2, Play, Square } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { useCurrentScreen } from '@/hooks/useRenderedFile'

export function RunButton() {
  const currentScreen = useCurrentScreen()
  const demoKind = useAppStore((s) => s.demoState.kind)
  const runDemo = useAppStore((s) => s.runDemo)
  const closeDemo = useAppStore((s) => s.closeDemo)
  const demoCount = currentScreen?.demos?.length ?? 0
  const hasDemo = demoCount > 0

  // Launching: fake-build sequence in-flight; disabled with spinner.
  if (demoKind === 'launching') {
    return (
      <button
        type="button"
        disabled
        title="Launching demo…"
        className="inline-flex items-center gap-2 rounded border border-app-border bg-app-panel px-3 py-1 text-base text-app-muted opacity-70"
      >
        <Loader2 className="size-5 animate-spin" />
        <span>Run</span>
      </button>
    )
  }

  // Video modal is open — button becomes Stop.
  if (demoKind === 'video') {
    return (
      <button
        type="button"
        onClick={closeDemo}
        title="Stop demo (Esc)"
        className="inline-flex items-center gap-2 rounded border border-red-500/60 bg-red-500/15 px-3 py-1 text-base text-red-400 hover:bg-red-500/25"
      >
        <Square className="size-5 fill-current" />
        <span>Stop</span>
      </button>
    )
  }

  // Idle (or picker open — clicking again should re-toggle the picker).
  const disabled = !hasDemo
  const title = disabled
    ? 'No demo configured'
    : demoCount > 1
      ? `Run demo (F5 / Ctrl+Enter) — ${demoCount} options`
      : 'Run demo (F5 / Ctrl+Enter)'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => runDemo()}
      title={title}
      className="inline-flex items-center gap-2 rounded border border-app-border bg-app-panel px-3 py-1 text-base text-app hover:bg-app-border disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Play className="size-5 fill-current" />
      <span>Run</span>
    </button>
  )
}
