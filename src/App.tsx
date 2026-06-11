import { AppShell } from './components/AppShell'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LoadErrorOverlay } from './components/LoadErrorOverlay'
import { BootCurtain } from './components/BootCurtain'
import { CursorSpotlight } from './components/CursorSpotlight'
import { ZoomViewport } from './components/ZoomViewport'
import { SettingsModal } from './components/SettingsModal'
import { VideoDemo } from './components/demo/VideoDemo'
import { DemoPicker } from './components/demo/DemoPicker'
import { SymbolFinder } from './components/SymbolFinder'
import { useAppStore } from './state/store'
import { usePreferencesPersistence } from './hooks/usePreferencesPersistence'
import { useUiScale } from './hooks/useUiScale'
import { useCursorSpotlight } from './hooks/useCursorSpotlight'
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
  useCursorSpotlight()
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
      {/* The magnifier wraps both the editor surface and the video modal so
          a single pan-and-zoom covers code AND demo playback (zooming into a
          small UI detail mid-clip is the primary use case). The cursor
          spotlight, pickers, and boot curtain stay outside: the spotlight
          tracks the raw on-screen pointer, and the transient chrome shouldn't
          scale with the presentation. */}
      <ZoomViewport>
        {project ? <AppShell /> : <WelcomeScreen />}
        <VideoDemo />
      </ZoomViewport>
      <CursorSpotlight />
      <DemoPicker />
      <SymbolFinder />
      <SettingsModal />
      <LoadErrorOverlay />
      {isRouting && <BootCurtain />}
    </>
  )
}
