import { GitBranch } from 'lucide-react'
import { useAppStore } from '@/state/store'

export function StageSelector() {
  const stages = useAppStore((s) => s.project?.stages ?? [])
  const currentStageAlias = useAppStore((s) => s.currentStageAlias)
  const switchStage = useAppStore((s) => s.switchStage)

  if (stages.length === 0) return null

  return (
    <label className="flex items-center gap-2 text-base text-app-muted">
      <GitBranch className="size-5 text-app-muted" />
      <select
        value={currentStageAlias ?? ''}
        onChange={(e) => switchStage(e.target.value)}
        className="rounded border border-app-border bg-app-panel px-2 py-1 text-base text-app focus:outline-none focus:ring-1 focus:ring-app-accent"
      >
        {[...stages]
          .sort((a, b) => a.order - b.order)
          .map((s) => (
            <option key={s.alias} value={s.alias}>
              {s.title ?? s.branch ?? s.alias}
            </option>
          ))}
      </select>
    </label>
  )
}
