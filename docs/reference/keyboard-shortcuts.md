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
preview modal is active. Buttons and the stage-selector dropdown
deliberately fall through — Space always advances the screen in
Prezl, even right after clicking an explorer item, so the presenter
clicker never gets stuck on the previous interaction.

## Preview

| Shortcut | Action |
| --- | --- |
| `F5` / `Ctrl+Enter` | Run (equivalent to clicking the Run button) |
| `F11` | Toggle fullscreen |

Run is suppressed while a preview is already in flight. When the
current screen has more than one preview the keyboard shortcut opens
the picker; pressing it again with the picker open closes it.

`F5` is captured globally so the WebView's default page-refresh
behaviour doesn't fire — `Ctrl+R` still does native refresh.

### Inside the preview picker

Shown when the screen has more than one preview entry; the keyboard
shortcut goes here before deciding what to launch.

| Shortcut | Action |
| --- | --- |
| `↑` / `↓` | Move selection |
| `Enter` | Run the selected preview |
| `Esc` | Close the picker without running |

### Inside a video preview

| Shortcut | Action |
| --- | --- |
| `Space` / `PageDown` | Play / pause. At `stopAt`: close and continue (forward nav default). |
| `Esc` / `PageUp` | Close the preview |
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

| Input | Action |
| --- | --- |
| Right-click a tab | Open the tab context menu |
| Context menu: **Close** | Close the right-clicked tab |
| Context menu: **Close Others** | Close every tab except the right-clicked one |
| Context menu: **Close All** | Close every open tab |

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
video preview modal is open.

## Presentation chrome

| Shortcut | Action |
| --- | --- |
| `Ctrl+E` | Toggle explorer visibility |
| `Ctrl+Shift+E` | Reveal active file in explorer *(planned)* |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out |
| `Ctrl+Up` / `Ctrl+Down` | Zoom in / out (alternate) |
| `Ctrl+0` | Reset zoom |
| `Ctrl+MouseWheel` | Continuous zoom |

Zoom scales both UI chrome (rem-based Tailwind) and the code viewer's
font together. The current zoom percentage flashes briefly in the
status bar.
