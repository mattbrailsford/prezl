import { GitBranch } from 'lucide-react'
import { useAppStore } from '@/state/store'

export function BranchSelector() {
  const branches = useAppStore((s) => s.project?.branches ?? [])
  const currentBranchName = useAppStore((s) => s.currentBranchName)
  const switchBranch = useAppStore((s) => s.switchBranch)

  if (branches.length === 0) return null

  return (
    <label className="flex items-center gap-2 text-base text-app-muted">
      <GitBranch className="size-5 text-app-muted" />
      <select
        value={currentBranchName ?? ''}
        onChange={(e) => switchBranch(e.target.value)}
        className="rounded border border-app-border bg-app-panel px-2 py-1 text-base text-app focus:outline-none focus:ring-1 focus:ring-app-accent"
      >
        {[...branches]
          .sort((a, b) => a.order - b.order)
          .map((b) => (
            <option key={b.name} value={b.name}>
              {b.title ?? b.name}
            </option>
          ))}
      </select>
    </label>
  )
}
