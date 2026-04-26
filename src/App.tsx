import { AppShell } from './components/AppShell'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LoadErrorOverlay } from './components/LoadErrorOverlay'
import { BootCurtain } from './components/BootCurtain'
import { VideoPreview } from './components/preview/VideoPreview'
import { SymbolFinder } from './components/SymbolFinder'
import { useAppStore } from './state/store'
import { usePreferencesPersistence } from './hooks/usePreferencesPersistence'
import { useUiScale } from './hooks/useUiScale'
import { useExplorerToggle } from './hooks/useExplorerToggle'
import { useStageShortcuts } from './hooks/useStageShortcuts'
import { useRunShortcut } from './hooks/useRunShortcut'
import { useSymbolFinderShortcut } from './hooks/useSymbolFinderShortcut'
import { useDeepLink } from './hooks/useDeepLink'
import { useMouseHistoryNav } from './hooks/useMouseHistoryNav'

export function App() {
  usePreferencesPersistence()
  useUiScale()
  useExplorerToggle()
  useStageShortcuts()
  useRunShortcut()
  useSymbolFinderShortcut()
  useDeepLink()
  useMouseHistoryNav()

  const project = useAppStore((s) => s.project)
  const isRouting = useAppStore((s) => s.isRouting)

  return (
    <>
      {project ? <AppShell /> : <WelcomeScreen />}
      <VideoPreview />
      <SymbolFinder />
      <LoadErrorOverlay />
      {isRouting && <BootCurtain />}
    </>
  )
}
