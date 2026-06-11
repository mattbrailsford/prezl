import { useEffect, useState, type CSSProperties, type ComponentType } from 'react'
import { MousePointer2, Pipette, ZoomIn } from 'lucide-react'
import { useAppStore } from '@/state/store'

// Preset halo colours + the canonical labels. The native colour input below
// covers anything not in this row.
const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: '#facc15', label: 'Yellow' },
  { value: '#ef4444', label: 'Red' },
  { value: '#22c55e', label: 'Green' },
  { value: '#38bdf8', label: 'Sky' },
  { value: '#e879f9', label: 'Magenta' },
  { value: '#ffffff', label: 'White' },
]

const MAGNIFY_LEVELS = [1.5, 2, 2.5, 3, 3.5, 4]

const SIZE_MIN = 40
const SIZE_MAX = 160

// Section registry. Add an entry here (id + label + icon + panel) and it
// shows up in the left nav automatically — the scalable shape for new
// presenter prefs.
type SectionId = 'cursor' | 'magnifier'
const SECTIONS: {
  id: SectionId
  label: string
  icon: ComponentType<{ className?: string }>
  Panel: ComponentType
}[] = [
  { id: 'cursor', label: 'Cursor highlight', icon: MousePointer2, Panel: CursorPanel },
  { id: 'magnifier', label: 'Magnifier', icon: ZoomIn, Panel: MagnifierPanel },
]

/**
 * Presenter-preference editor, IDE-style: a section list on the left, the
 * selected section's controls on the right. Home for the knobs that can't
 * reasonably be a keyboard shortcut. Opened from the status-bar gear; never
 * appears during a talk unless the presenter asks for it.
 *
 * Changes write straight to `preferences` (no apply/cancel) so the real halo
 * and the in-modal preview update live, and the existing debounced
 * persistence saves them.
 */
export function SettingsModal() {
  const open = useAppStore((s) => s.settingsOpen)
  const close = useAppStore((s) => s.closeSettings)
  const [active, setActive] = useState<SectionId>('cursor')

  // Esc closes. Declared before the early return so hook order is stable
  // every render (see the SymbolFinder hook-ordering note in CLAUDE.md).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [open, close])

  if (!open) return null

  const ActivePanel =
    SECTIONS.find((s) => s.id === active)?.Panel ?? SECTIONS[0].Panel

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[70vh] max-h-[640px] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-app-border bg-app-panel px-4 py-3">
          <h2 className="text-sm font-semibold text-app">Settings</h2>
          <button
            type="button"
            onClick={close}
            className="rounded px-2 py-0.5 text-xs text-app-muted hover:bg-app-border hover:text-app"
          >
            Done (Esc)
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Section list */}
          <nav className="flex w-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-app-border bg-app-panel/40 p-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const selected = s.id === active
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors ${
                    selected
                      ? 'bg-app-panel font-medium text-app'
                      : 'text-app-muted hover:bg-app-panel/60 hover:text-app'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{s.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Detail pane */}
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            <ActivePanel />
          </div>
        </div>
      </div>
    </div>
  )
}

function CursorPanel() {
  const prefs = useAppStore((s) => s.preferences)
  const setPreferences = useAppStore((s) => s.setPreferences)

  const previewStyle: CSSProperties = {
    width: prefs.cursorSpotlightSize,
    height: prefs.cursorSpotlightSize,
    borderRadius: 9999,
    border: `3px dotted ${prefs.cursorSpotlightColor}`,
    boxShadow: `inset 0 0 0 5px color-mix(in srgb, ${prefs.cursorSpotlightColor} 35%, transparent)`,
  }

  return (
    <section className="flex flex-col gap-5">
      <PanelHeader title="Cursor highlight" hint="Ctrl/Cmd+Shift+H" />

      <label className="flex items-center gap-2 text-sm text-app">
        <input
          type="checkbox"
          checked={prefs.cursorSpotlight}
          onChange={(e) => setPreferences({ cursorSpotlight: e.target.checked })}
        />
        <span>Show a halo around the cursor</span>
      </label>

      <div className="flex items-start gap-5">
        {/* Live preview against a dark plate so the ring reads true. */}
        <div className="grid size-[176px] shrink-0 place-items-center rounded-md border border-app-border bg-app">
          <div style={previewStyle} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-app-muted">Colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => {
                const selected =
                  prefs.cursorSpotlightColor.toLowerCase() === c.value
                return (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    onClick={() =>
                      setPreferences({ cursorSpotlightColor: c.value })
                    }
                    className={`size-6 rounded-full border transition-transform hover:scale-110 ${
                      selected
                        ? 'border-app ring-2 ring-app-accent'
                        : 'border-app-border'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                )
              })}
              {/* Custom colour: the circle shows the active colour; the real
                  <input type=color> sits invisibly on top so a click opens
                  the native macOS colour panel. The pipette uses
                  mix-blend-difference so it stays legible on any background. */}
              <label
                title="Custom colour — opens the system colour picker"
                className="relative ml-1 grid size-6 cursor-pointer place-items-center rounded-full border border-app-border"
                style={{ backgroundColor: prefs.cursorSpotlightColor }}
              >
                <Pipette className="size-3 text-white mix-blend-difference" />
                <input
                  type="color"
                  value={prefs.cursorSpotlightColor}
                  onChange={(e) =>
                    setPreferences({ cursorSpotlightColor: e.target.value })
                  }
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-app-muted">Size</span>
              <span className="text-[11px] tabular-nums text-app-muted">
                {prefs.cursorSpotlightSize}px
              </span>
            </div>
            <input
              type="range"
              min={SIZE_MIN}
              max={SIZE_MAX}
              step={4}
              value={prefs.cursorSpotlightSize}
              onChange={(e) =>
                setPreferences({ cursorSpotlightSize: Number(e.target.value) })
              }
              className="w-full accent-app-accent"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function MagnifierPanel() {
  const level = useAppStore((s) => s.preferences.magnifyToggleLevel)
  const setPreferences = useAppStore((s) => s.setPreferences)

  return (
    <section className="flex flex-col gap-5">
      <PanelHeader title="Magnifier" hint="Ctrl/Cmd+Shift+Z · +/− · 0/Esc" />

      <label className="flex items-center justify-between gap-3 text-sm text-app">
        <span>
          Toggle zoom level
          <span className="ml-2 text-xs text-app-muted">
            what Ctrl/Cmd+Shift+Z jumps to
          </span>
        </span>
        <select
          value={level}
          onChange={(e) =>
            setPreferences({ magnifyToggleLevel: Number(e.target.value) })
          }
          className="rounded border border-app-border bg-app-panel px-2 py-1 text-sm"
        >
          {MAGNIFY_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}×
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}

function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-app-border pb-2">
      <h3 className="text-sm font-semibold text-app">{title}</h3>
      {hint && <span className="text-[10px] text-app-muted">{hint}</span>}
    </div>
  )
}
