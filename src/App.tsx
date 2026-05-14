import { AppShell } from './components/AppShell'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LoadErrorOverlay } from './components/LoadErrorOverlay'
import { BootCurtain } from './components/BootCurtain'
import { VideoDemo } from './components/demo/VideoDemo'
import { DemoPicker } from './components/demo/DemoPicker'
import { SymbolFinder } from './components/SymbolFinder'
import { useAppStore } from './state/store'
import { usePreferencesPersistence } from './hooks/usePreferencesPersistence'
import { useUiScale } from './hooks/useUiScale'
import { useExplorerToggle } from './hooks/useExplorerToggle'
import { useStageShortcuts } from './hooks/useStageShortcuts'
import { useRunShortcut } from './hooks/useRunShortcut'
import { useReloadShortcut } from './hooks/useReloadShortcut'
import { useSymbolFinderShortcut } from './hooks/useSymbolFinderShortcut'
import { useTabShortcuts } from './hooks/useTabShortcuts'
import { useDeepLink } from './hooks/useDeepLink'
import { useMouseHistoryNav } from './hooks/useMouseHistoryNav'
import { useHistoryShortcut } from './hooks/useHistoryShortcut'

export function App() {
  usePreferencesPersistence()
  useUiScale()
  useExplorerToggle()
  useStageShortcuts()
  useRunShortcut()
  useReloadShortcut()
  useSymbolFinderShortcut()
  useTabShortcuts()
  useDeepLink()
  useMouseHistoryNav()
  useHistoryShortcut()

  const project = useAppStore((s) => s.project)
  const isRouting = useAppStore((s) => s.isRouting)

  return (
    <>
      {project ? <AppShell /> : <WelcomeScreen />}
      <VideoDemo />
      <DemoPicker />
      <SymbolFinder />
      <LoadErrorOverlay />
      {isRouting && <BootCurtain />}
    </>
  )
}
