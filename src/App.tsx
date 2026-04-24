import { useEffect } from 'react'
import { AppShell } from './components/AppShell'
import { useAppStore } from './state/store'
import { usePreferencesPersistence } from './hooks/usePreferencesPersistence'
import { useUiScale } from './hooks/useUiScale'
import { useExplorerToggle } from './hooks/useExplorerToggle'
import { M1_FIXTURE } from './project/fixtures'

export function App() {
  usePreferencesPersistence()
  useUiScale()
  useExplorerToggle()

  const project = useAppStore((s) => s.project)
  const setProject = useAppStore((s) => s.setProject)

  useEffect(() => {
    if (!project) setProject(M1_FIXTURE)
  }, [project, setProject])

  return <AppShell />
}
