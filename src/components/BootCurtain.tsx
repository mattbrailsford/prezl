import { PretzelLogo } from './PretzelLogo'

/** Full-screen black overlay used during cold-start routing and runtime
 *  deep-link transitions. Blocks every visual flash between the welcome
 *  screen, recent auto-open, and the eventual settled project state. The
 *  logo is shown faintly so the user knows the app is still alive. */
export function BootCurtain() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      aria-hidden
      data-tauri-drag-region
    >
      <PretzelLogo className="size-12 text-app-muted/30" />
    </div>
  )
}
