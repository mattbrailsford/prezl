# Keyboard shortcuts

Every shortcut registered by Prezl, grouped by what it drives.

## Stage navigation

| Shortcut | Action |
| --- | --- |
| `Space` / `PageDown` | Next stage |
| `Shift+Space` / `PageUp` | Previous stage |
| `Ctrl+Space` / `Ctrl+Shift+Space` | Legacy aliases — same as above |

Suppressed when focus is on a real form control (button, `<select>`,
`<input>`/`<textarea>` outside Monaco, `contentEditable`), and while
the video preview modal is active. Monaco's hidden input area is **not**
treated as interactive — Space advances the stage even when the editor
has focus, which is the main presentation case.

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

Zoom scales both UI chrome (rem-based Tailwind) and the Monaco editor
font together. The current zoom percentage flashes briefly in the status
bar.

## Monaco-owned bindings we disable

Prezl disables a handful of Monaco built-ins that would otherwise
conflict with our global shortcuts:

- `Ctrl+T` / `Cmd+T` — Monaco's Go-to-Symbol
- `Ctrl+Shift+O` — Monaco's Go-to-Symbol in Editor
- `Ctrl+P` / `Ctrl+Shift+P` — Monaco's Quick Open / Command Palette

This is transparent to authors; you just get Prezl's finder instead of
Monaco's symbol picker.
