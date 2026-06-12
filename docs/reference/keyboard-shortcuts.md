# Keyboard shortcuts

Every shortcut registered by Prezl, grouped by what it drives.

## Screen navigation

Each stage has one or more **screens** — the unit the presenter
advances through. A stage with `steps:` produces one screen per step;
a stage without produces a single implicit screen. Forward and back
navigation walks every screen end-to-end, including across stage
boundaries.

| Shortcut | Action |
| --- | --- |
| `Space` / `PageDown` | Next screen (next step within stage, or first step of next stage) |
| `Shift+Space` / `PageUp` | Previous screen |
| `Ctrl+Space` / `Ctrl+Shift+Space` | Legacy aliases — same as above |

Suppressed only while a text-typing surface owns focus
(`<input>` / `<textarea>` / `contentEditable`) and while the video
demo modal is active. Buttons and the stage-selector dropdown
deliberately fall through — Space always advances the screen in
Prezl, even right after clicking an explorer item, so the presenter
clicker never gets stuck on the previous interaction.

## Demo

| Shortcut | Action |
| --- | --- |
| `F5` / `Ctrl+F5` / `Ctrl+Enter` | Run (equivalent to clicking the Run button) |

Run is suppressed while a demo is already in flight. When the
current screen has more than one demo the keyboard shortcut opens
the picker; pressing it again with the picker open closes it.

`F5` and `Ctrl+F5` are captured globally so the WebView's default
page-refresh behaviours don't fire — `Ctrl+R` still does native
refresh.

### Inside the demo picker

Shown when the screen has more than one demo entry; the keyboard
shortcut goes here before deciding what to launch.

| Shortcut | Action |
| --- | --- |
| `↑` / `↓` | Move selection |
| `Enter` | Run the selected demo |
| `Esc` | Close the picker without running |

### Inside a video demo

| Shortcut | Action |
| --- | --- |
| `Space` / `PageDown` | Play / pause. At `stopAt`: close and continue (forward nav default). |
| `Ctrl+W` / `Cmd+W` / `PageUp` | Close the demo. `Esc` is intentionally **not** bound here — too easy to fat-finger mid-clip and lose the playback position. |
| Restart chip click | Replay the clip from `startAt` (deliberate; nav keys won't do this). |

## Editor symbols

| Shortcut | Action |
| --- | --- |
| `Ctrl+T` / `Cmd+T` | Open the fuzzy symbol finder |
| `Click` on an underlined identifier | Jump to its `@prezl id=` anchor |

Inside the symbol finder modal:

| Shortcut | Action |
| --- | --- |
| `↑` / `↓` | Move selection |
| `Enter` | Jump to selected symbol |
| `Esc` | Close finder |

## Editor tabs

| Shortcut | Action |
| --- | --- |
| `Ctrl+W` / `Cmd+W` | Close the active tab |
| `Ctrl+Home` / `Ctrl+H` | Re-apply the current screen's `open:` anchor |

`Ctrl+H` is an alias for laptops without a dedicated Home key.

| Input | Action |
| --- | --- |
| Right-click a tab | Open the tab context menu |
| Context menu: **Close** | Close the right-clicked tab |
| Context menu: **Close Others** | Close every tab except the right-clicked one |
| Context menu: **Close All** | Close every open tab |

`Ctrl+Home` is the recovery path when the presenter has closed (or
navigated away from) the file the screen authored. It re-opens the
resolved `open:` target and scrolls to its `id` / `line` anchor — same
landing the screen does on entry. No-op with a status flash on screens
that don't declare an `open:`.

Closing a tab doesn't push to location history (closing is editing,
not navigating), so back/forward continues to walk the screens you
actually visited.

## Slide-deck integration

| Shortcut | Action |
| --- | --- |
| `Shift+Esc` | Hand focus back to the slide deck (hidden when Prezl wasn't launched with `hideOnExit=1`) |

See [Slide-deck integration](../guide/slide-deck-integration) for the
full launch flow and the [`prezl://` URL scheme](./url-scheme).

## Mouse navigation

| Button | Action |
| --- | --- |
| Side button 1 (XButton1, "back") | Back through location history |
| Side button 2 (XButton2, "forward") | Forward through location history |

History records every user-initiated change of `(screen, file)` —
explorer clicks, tab clicks, screen advances, symbol jumps. Adjacent
duplicates collapse, and a new navigation truncates the forward stack
(standard browser behaviour). Each location remembers its scroll
position so back / forward land you exactly where you left off,
overriding the screen's default `open` target. Suppressed while the
video demo modal is open.

## Presentation chrome

| Shortcut | Action |
| --- | --- |
| `Ctrl+E` | Toggle explorer visibility |
| `Ctrl+Shift+E` | Reveal active file in explorer *(planned)* |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out (font / reflow) |
| `Ctrl+Up` / `Ctrl+Down` | Zoom in / out (alternate) |
| `Ctrl+0` | Reset zoom |
| `F11` (Win/Linux) / `Fn+F` (Mac) / `⌃⌘F` (Mac) | Toggle fullscreen |

Zoom scales both UI chrome (rem-based Tailwind) and the code viewer's
font together. The current zoom percentage flashes briefly in the
status bar. `Cmd` works in place of `Ctrl` on every zoom shortcut, so
`Cmd+0` resets just as well.

> This is **reflow** zoom — text gets bigger and re-wraps. For an
> *optical* zoom that magnifies a region pixel-for-pixel (and works on
> demo videos), see the magnifier below.

## Presentation aids

Live presenter tools — a cursor highlight and an optical magnifier.
`Cmd` works in place of `Ctrl` throughout. Full walkthrough:
[Presentation aids](../guide/presentation-aids).

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+H` | Toggle the cursor highlight halo |
| `Ctrl+Shift+Z` | Toggle the magnifier (off ↔ the configured level) |
| `Ctrl+Shift+=` / `Ctrl+Shift+-` | Step the magnifier zoom level |
| `Ctrl+Shift+0` / `Esc` | Reset the magnifier to 1× |

The magnifier anchors on the cursor when you trigger it, then pans when
you move the pointer into the screen edges (it never chases the cursor
directly). It covers the code surface **and** a playing demo video.
`Esc` only resets the magnifier while it's zoomed — otherwise it falls
through. Halo colour / size and the magnifier's toggle level are set in
the status-bar settings panel (gear icon, bottom-right).

> The cursor highlight and magnifier are keyboard-toggled, and macOS
> hides the system arrow on any key input — so the pointer briefly
> vanishes when you press these (it returns on the next mouse move). The
> halo itself stays visible.

> Zoom is keyboard-only by design. A macOS trackpad pinch reaches the
> web view as `Ctrl+MouseWheel`, so binding wheel zoom meant a stray
> pinch could silently rescale the whole presentation mid-talk — `Cmd+0`
> was the only way back. Wheel/pinch zoom is therefore not bound.

`Fn+F` on Mac is the system-level fullscreen action — Prezl's
NSWindow has `NSWindowCollectionBehaviorFullScreenPrimary` enabled at
startup, so macOS routes it straight to native Cocoa fullscreen (with
the usual Spaces animation). `F11` and `⌃⌘F` go through JavaScript
and reach the Tauri window API. All three stay live while a video
demo modal is open, so an accidental fullscreen exit mid-clip is
recoverable without closing and replaying the video.
