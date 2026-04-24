import { Minus, Square, Copy, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'

const appWindow = getCurrentWindow()

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)

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

  return (
    <div className="flex items-stretch">
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
