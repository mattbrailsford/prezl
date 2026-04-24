import { useEffect, useRef } from 'react'
import { AppShell } from './components/AppShell'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LoadErrorOverlay } from './components/LoadErrorOverlay'
import { useAppStore } from './state/store'
import { usePreferencesPersistence } from './hooks/usePreferencesPersistence'
import { useUiScale } from './hooks/useUiScale'
import { useExplorerToggle } from './hooks/useExplorerToggle'
import { useBranchShortcuts } from './hooks/useBranchShortcuts'
import { useRunShortcut } from './hooks/useRunShortcut'
import { useOpenProject } from './hooks/useProjectLoader'
import { listRecents } from './project/recents'

export function App() {
  usePreferencesPersistence()
  useUiScale()
  useExplorerToggle()
  useBranchShortcuts()
  useRunShortcut()

  const project = useAppStore((s) => s.project)
  const openProject = useOpenProject()
  const autoOpenAttempted = useRef(false)

  useEffect(() => {
    if (autoOpenAttempted.current) return
    autoOpenAttempted.current = true
    ;(async () => {
      try {
        const recents = await listRecents()
        const latest = recents[0]
        if (!latest) return
        // Silently drop the entry if the folder moved / no longer has prezl.yaml.
        await openProject(latest.path, { silentFailure: true })
      } catch {
        /* non-fatal */
      }
    })()
  }, [openProject])

  return (
    <>
      {project ? <AppShell /> : <WelcomeScreen />}
      <LoadErrorOverlay />
    </>
  )
}
