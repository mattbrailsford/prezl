import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileDown, Link2, Link2Off, Share2 } from 'lucide-react'
import { useAppStore } from '@/state/store'
import { isPortableMode } from '@/project/portable'
import {
  isProtocolRegistered,
  registerProtocol,
  unregisterProtocol,
} from '@/project/protocol'
import { buildDeepLink } from '@/project/deepLink'
import { saveDeckLinkFile } from '@/project/deckLinkFile'

type Toast = { kind: 'ok' | 'err'; text: string } | null

const TOAST_MS = 2200

/** Right-aligned status-bar group:
 *   - register/unregister toggle (portable mode only)
 *   - share-link icon — plain click copies a sensible default;
 *     alt-click / right-click opens the options popover.
 *
 *  In installed mode the protocol is registered by the bundler, so the
 *  toggle is hidden and copying just works.
 *
 *  When portable + not registered, the link icon refuses to copy and
 *  prompts the user to register first. We never put a non-functional URL
 *  on the clipboard. */
export function StatusBarLinkControls() {
  const project = useAppStore((s) => s.project)
  const screenIndex = useAppStore((s) => s.screenIndex)
  const currentScreenId = useAppStore((s) => s.currentScreenId)

  const [portable, setPortable] = useState(false)
  const [registered, setRegistered] = useState<boolean | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const p = await isPortableMode()
      if (cancelled) return
      setPortable(p)
      const r = await isProtocolRegistered()
      if (!cancelled) setRegistered(r)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const onToggleRegister = useCallback(async () => {
    try {
      if (registered) {
        await unregisterProtocol()
        setRegistered(false)
        setToast({ kind: 'ok', text: 'Slide-deck links disabled' })
      } else {
        await registerProtocol()
        setRegistered(true)
        setToast({ kind: 'ok', text: 'Slide-deck links enabled' })
      }
    } catch (e) {
      console.error('protocol toggle failed:', e)
      const msg =
        typeof e === 'string'
          ? e
          : (e as { message?: string; kind?: string })?.message ??
            (e as { kind?: string })?.kind ??
            'Registration failed'
      setToast({ kind: 'err', text: msg })
    }
  }, [registered])

  const linkBlocked = portable && registered === false

  type LinkOpts = { screen?: string; fullscreen: boolean; hideOnExit: boolean }

  const buildLink = useCallback(
    (opts: LinkOpts): string | null => {
      if (!project?.rootPath) return null
      return buildDeepLink({
        path: project.rootPath,
        screen: opts.screen,
        fullscreen: opts.fullscreen,
        hideOnExit: opts.hideOnExit,
      })
    },
    [project?.rootPath],
  )

  const guard = useCallback((): boolean => {
    if (linkBlocked) {
      setToast({
        kind: 'err',
        text: 'Click the link icon to register prezl:// first',
      })
      return false
    }
    return true
  }, [linkBlocked])

  const copyLink = useCallback(
    async (opts: LinkOpts) => {
      if (!guard()) return
      const url = buildLink(opts)
      if (!url) return
      try {
        await navigator.clipboard.writeText(url)
        setToast({ kind: 'ok', text: 'Link copied' })
      } catch (e) {
        setToast({ kind: 'err', text: (e as Error).message ?? 'Copy failed' })
      }
    },
    [buildLink, guard],
  )

  const saveLink = useCallback(
    async (opts: LinkOpts) => {
      if (!guard()) return
      const url = buildLink(opts)
      if (!url || !project) return
      try {
        const saved = await saveDeckLinkFile({
          url,
          title: `Open ${project.name} in Prezl`,
          defaultName: defaultShortcutName(project.name, opts.screen),
        })
        if (saved) setToast({ kind: 'ok', text: 'Shortcut saved' })
      } catch (e) {
        console.error('save_deck_link_file failed:', e)
        const msg =
          typeof e === 'string'
            ? e
            : (e as { message?: string })?.message ?? 'Save failed'
        setToast({ kind: 'err', text: msg })
      }
    },
    [buildLink, guard, project],
  )

  const onLinkClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // Alt-click opens the options popover instead of copying.
      if (e.altKey) {
        e.preventDefault()
        setPopoverOpen((v) => !v)
        return
      }
      void copyLink({
        screen: currentScreenId ?? undefined,
        fullscreen: true,
        hideOnExit: true,
      })
    },
    [copyLink, currentScreenId],
  )

  const onLinkContextMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      setPopoverOpen((v) => !v)
    },
    [],
  )

  if (!project) return null

  // Show the register toggle in portable mode (always — user owns the
  // registration lifecycle) and in any mode where the protocol isn't
  // registered yet (covers dev builds + installed builds whose installer
  // didn't register, e.g. the bundler was skipped). Once an installed
  // build is registered, the toggle disappears.
  const showRegisterToggle = portable || registered === false
  const showLinkIcon = true

  return (
    <div className="relative flex items-center gap-2">
      {toast && (
        <span
          className={
            'pointer-events-none rounded px-1.5 py-0.5 text-[11px] ' +
            (toast.kind === 'ok'
              ? 'bg-app-accent/15 text-app-accent'
              : 'bg-red-500/15 text-red-400')
          }
        >
          {toast.text}
        </span>
      )}

      {showRegisterToggle && (
        <button
          type="button"
          onClick={onToggleRegister}
          title={
            registered
              ? 'Disable slide-deck links (removes prezl:// from your user registry)'
              : 'Enable slide-deck links (registers prezl:// to this exe)'
          }
          className="grid size-6 place-items-center rounded text-app-muted hover:bg-app-panel hover:text-app"
          aria-pressed={!!registered}
        >
          {registered ? (
            <Check className="size-3.5" />
          ) : (
            <Link2Off className="size-3.5" />
          )}
        </button>
      )}

      {showLinkIcon && (
        <button
          type="button"
          onClick={onLinkClick}
          onContextMenu={onLinkContextMenu}
          title="Copy slide-deck link to current screen — alt-click or right-click for options"
          className="grid size-6 place-items-center rounded text-app-muted hover:bg-app-panel hover:text-app"
        >
          <Share2 className="size-3.5" />
        </button>
      )}

      {popoverOpen && (
        <LinkOptionsPopover
          screenIndex={screenIndex}
          currentScreenId={currentScreenId}
          linkBlocked={linkBlocked}
          onCopy={(opts) => {
            void copyLink(opts)
            setPopoverOpen(false)
          }}
          onSave={(opts) => {
            void saveLink(opts)
            setPopoverOpen(false)
          }}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  )
}

function defaultShortcutName(projectName: string, screen?: string): string {
  const slugProj = slugify(projectName) || 'prezl'
  if (!screen) return slugProj
  return `${slugProj}-${slugify(screen)}`
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type ScreenIndexShape = ReturnType<typeof useAppStore.getState>['screenIndex']

function LinkOptionsPopover({
  screenIndex,
  currentScreenId,
  linkBlocked,
  onCopy,
  onSave,
  onClose,
}: {
  screenIndex: ScreenIndexShape
  currentScreenId: string | null
  linkBlocked: boolean
  onCopy: (opts: { screen?: string; fullscreen: boolean; hideOnExit: boolean }) => void
  onSave: (opts: { screen?: string; fullscreen: boolean; hideOnExit: boolean }) => void
  onClose: () => void
}) {
  const [target, setTarget] = useState<'project' | 'current' | string>(
    currentScreenId ? 'current' : 'project',
  )
  const [fullscreen, setFullscreen] = useState(true)
  const [hideOnExit, setHideOnExit] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  const screens = useMemo(() => screenIndex?.ordered ?? [], [screenIndex])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  const resolveScreen = (): string | undefined => {
    if (target === 'project') return undefined
    if (target === 'current') return currentScreenId ?? undefined
    return target
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-7 right-0 z-50 flex w-72 flex-col gap-3 rounded-md border border-app-border bg-app-surface p-3 text-xs text-app shadow-lg"
    >
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
          Target
        </label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded border border-app-border bg-app-panel px-2 py-1"
        >
          <option value="project">Whole project (first screen)</option>
          {currentScreenId && (
            <option value="current">Current screen — {currentScreenId}</option>
          )}
          <optgroup label="Specific screen">
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={fullscreen}
          onChange={(e) => setFullscreen(e.target.checked)}
        />
        <span>Open in fullscreen</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={hideOnExit}
          onChange={(e) => setHideOnExit(e.target.checked)}
        />
        <span>Show "Back to presentation" button</span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={linkBlocked}
          onClick={() =>
            onCopy({ screen: resolveScreen(), fullscreen, hideOnExit })
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded bg-app-accent/20 px-2 py-1.5 text-app-accent hover:bg-app-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Link2 className="size-3.5" />
          Copy link
        </button>
        <button
          type="button"
          disabled={linkBlocked}
          onClick={() =>
            onSave({ screen: resolveScreen(), fullscreen, hideOnExit })
          }
          title="Save a shortcut file (.url / .webloc / .desktop). Useful for slide tools that hijack hyperlinks (WPS, browser-based decks)."
          className="flex items-center justify-center gap-1.5 rounded border border-app-border bg-app-panel px-2 py-1.5 text-app hover:bg-app-border disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileDown className="size-3.5" />
          Save shortcut
        </button>
      </div>
      {linkBlocked && (
        <p className="text-[11px] text-app-muted">
          Enable slide-deck links first (icon to the left).
        </p>
      )}
    </div>
  )
}
