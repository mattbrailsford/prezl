import { useAppStore } from '@/state/store'
import { TopBar } from './TopBar'
import { ExplorerTree } from './ExplorerTree'
import { ExplorerResizeHandle } from './ResizeHandle'
import { EditorTabs } from './EditorTabs'
import { CodeEditor } from './CodeEditor'
import { StatusBar } from './StatusBar'

export function AppShell() {
  const explorerCollapsed = useAppStore((s) => s.preferences.explorerCollapsed)
  const explorerWidth = useAppStore((s) => s.preferences.explorerWidth)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {!explorerCollapsed && (
          <>
            <aside
              style={{ width: `${explorerWidth}px` }}
              className="min-h-0 shrink-0 overflow-hidden bg-app-surface"
            >
              <ExplorerTree />
            </aside>
            <ExplorerResizeHandle />
          </>
        )}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <EditorTabs />
          <div className="flex min-h-0 flex-1">
            <CodeEditor />
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
