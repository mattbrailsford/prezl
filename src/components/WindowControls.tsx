import { Copy, Maximize2, Minimize2, Minus, Square, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'
import { useFullscreen } from '@/hooks/useFullscreen'

const appWindow = getCurrentWindow()

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  useEffect(() => {
    let cancelled = false
    appWindow.isMaximized().then((v) => {
      if (!cancelled) setIsMaximized(v)
    })
    const unlistenPromise = appWindow.onResized(async () => {
      const v = await appWindow.isMaximized()
      if (!cancelled) setIsMaximized(v)
    })
    return () => {
      cancelled = true
      unlistenPromise.then((un) => un())
    }
  }, [])

  const RestoreIcon = Copy

  const isMac = navigator.userAgent.toLowerCase().includes('mac')
  const fullscreenShortcut = isMac ? 'Fn+F' : 'F11'

  return (
    <div className="flex items-stretch">
      <ControlButton
        onClick={toggleFullscreen}
        label={
          isFullscreen
            ? `Exit fullscreen (${fullscreenShortcut})`
            : `Enter fullscreen (${fullscreenShortcut})`
        }
      >
        {isFullscreen ? (
          <Minimize2 className="size-4" />
        ) : (
          <Maximize2 className="size-4" />
        )}
      </ControlButton>
      {/* Minimize and Maximize are meaningless in fullscreen — hide them so
          the titlebar stays focused on just "exit fullscreen" + close. */}
      {!isFullscreen && (
        <>
          <ControlButton
            onClick={() => appWindow.minimize()}
            label="Minimize"
          >
            <Minus className="size-4" />
          </ControlButton>
          <ControlButton
            onClick={() => appWindow.toggleMaximize()}
            label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <RestoreIcon className="size-[14px] -scale-x-100" />
            ) : (
              <Square className="size-[14px]" />
            )}
          </ControlButton>
        </>
      )}
      <ControlButton
        onClick={() => appWindow.close()}
        label="Close"
        variant="close"
      >
        <X className="size-4" />
      </ControlButton>
    </div>
  )
}

function ControlButton({
  children,
  onClick,
  label,
  variant = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  variant?: 'default' | 'close'
}) {
  const closeHover =
    variant === 'close' ? 'hover:bg-red-600 hover:text-white' : 'hover:bg-app-panel'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-12 w-11 place-items-center text-app-muted ${closeHover}`}
    >
      {children}
    </button>
  )
}
