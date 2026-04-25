# Keyboard shortcuts

Every shortcut registered by Prezl, grouped by what it drives.

## Stage navigation

| Shortcut | Action |
| --- | --- |
| `Space` / `PageDown` | Next stage |
| `Shift+Space` / `PageUp` | Previous stage |
| `Ctrl+Space` / `Ctrl+Shift+Space` | Legacy aliases — same as above |

Suppressed only while a text-typing surface owns focus
(`<input>` / `<textarea>` / `contentEditable`) and while the video
preview modal is active. Buttons and the stage-selector dropdown
deliberately fall through — Space always advances the stage in
Prezl, even right after clicking an explorer item, so the presenter
clicker never gets stuck on the previous interaction.

## Preview

| Shortcut | Action |
| --- | --- |
| `Ctrl+Enter` | Run (equivalent to clicking the Run button) |
| `F11` | Toggle fullscreen |

Run is suppressed while a preview is already in flight.

### Inside a video preview

| Shortcut | Action |
| --- | --- |
| `Space` / `PageDown` | Play / pause. At `stopAt`: restart. |
| `Esc` / `PageUp` | Close the preview |

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
