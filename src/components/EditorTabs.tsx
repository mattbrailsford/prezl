import { PanelLeftOpen, X } from 'lucide-react'
import { useAppStore } from '@/state/store'

export function EditorTabs() {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeFile = useAppStore((s) => s.activeFile)
  const setActiveFile = useAppStore((s) => s.setActiveFile)
  const closeTab = useAppStore((s) => s.closeTab)
  const explorerCollapsed = useAppStore((s) => s.preferences.explorerCollapsed)
  const setPreferences = useAppStore((s) => s.setPreferences)

  const expandExplorerButton = explorerCollapsed ? (
    <button
      type="button"
      onClick={() => setPreferences({ explorerCollapsed: false })}
      title="Show explorer (Ctrl+E)"
      aria-label="Show explorer"
      className="grid h-11 w-11 shrink-0 place-items-center border-r border-app-border text-app-muted hover:bg-app-panel hover:text-app"
    >
      <PanelLeftOpen className="size-5" />
    </button>
  ) : null

  if (openTabs.length === 0) {
    return (
      <div className="flex h-11 items-stretch border-b border-app-border bg-app-surface">
        {expandExplorerButton}
        <div className="flex items-center px-3 text-base text-app-muted">
          No file open
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-11 items-stretch border-b border-app-border bg-app-surface">
      {expandExplorerButton}
      {openTabs.map((path) => {
        const isActive = path === activeFile
        const name = path.split('/').pop() ?? path
        return (
          <div
            key={path}
            className={`group flex items-center gap-2 border-r border-app-border px-3 text-base ${
              isActive
                ? 'bg-app-panel text-app'
                : 'text-app-muted hover:bg-app-panel/60'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveFile(path)}
              className="py-2 pr-1"
              title={path}
            >
              {name}
            </button>
            <button
              type="button"
              onClick={() => closeTab(path)}
              className="grid size-7 place-items-center rounded text-app-muted hover:bg-app-border hover:text-app"
              title="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
