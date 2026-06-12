First stable release. Prezl drops the beta suffix — branches-as-stages, inline `@prezl` directives, demos, and the slide-deck deep-link integration are all settled. This release adds live presenter aids (a cursor halo and an optical magnifier) and finishes the demo scrub bar.

## Highlights

- **Presenter aids: cursor halo + magnifier.** Two live tools layered over the deck, separate from the authored `focus=` / `collapse=` emphasis. The **cursor halo** (`⌃⇧H`) is a Presentify-style dotted ring that follows the mouse, fades on idle, and scales on click — colour and size are tunable. The **magnifier** (`⌃⇧Z`) is a CSS-transform optical zoom that wraps the shell *and* the video modal, so demo playback zooms too; `+`/`−` step the level, `0`/`Esc` reset, and it edge-nudge pans as the cursor approaches a viewport edge. Both are suppressed while a demo modal is up. Colour, size, and default zoom level are edited in a new **Settings** modal (the status-bar gear).
- **Demo scrub bar.** The video demo modal gets a clean scrub bar — an even-padded pill, drag-to-seek, and a resume reveal so picking up mid-clip lands where you expect.

## Fixes

- **Demo cue scrub-bar seek and resume reveal.** Seeking via the scrub bar now lands on the right frame, and resuming a paused clip reveals the playhead correctly instead of snapping.
- **Presentation-mode zoom and video scrubbing snags.** Cleaned up edge cases where the magnifier and the video scrubber fought over pointer state.

## Companion VS Code extension

No companion extension change in this release. The latest published `prezl-vscode` (0.3.0) remains compatible.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Developer ID signing + notarization is documented internally and on the near-term roadmap.
- **No auto-update.** Each release is a fresh download.
