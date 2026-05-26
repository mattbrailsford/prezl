Ninth beta — mostly a macOS polish pass (native fullscreen, the keyboard shortcuts that were silently no-op under WKWebView), plus mermaid diagrams in markdown and a couple of video-modal fixes.

## Highlights

- **Native macOS fullscreen.** The borderless window now opts into AppKit's `FullScreenPrimary` collection behaviour with a titled + full-size-content-view style mask. `Fn+F` (the system shortcut) and `⌃⌘F` both toggle fullscreen the same way Keynote does — no mid-transition gap above the header, no chrome to hide. F11 still works on Windows/Linux, and the binding is no longer suppressed while a video demo is open, so an accidental fullscreen exit mid-clip is recoverable.
- **Mermaid diagrams in markdown.** ` ```mermaid ` code fences now upgrade to inline SVG via mermaid 11. Same async pattern as Shiki — base text shows immediately, the diagram swaps in once the renderer is ready. Useful for sequence / flow / state diagrams in `.prezl/` intros.
- **macOS reload and history shortcuts.** `⌘R` (reload), `⌘[` / `⌘]` (back/forward), and `⌥←` / `⌥→` (cross-platform back/forward) now work on macOS. WKWebView doesn't ship default keyboard shortcuts the way WebView2 does on Windows, so these were silently no-op before. Both follow the existing suppression rules (skip text-typing targets, skip while a video demo is up).

## Fixes

- **Video resume re-arms when scrubbing back from the end.** Scrubbing back past the end of a demo video left the `atEnd` flag set, so the next Space press closed the modal instead of resuming playback. The seek handler now clears it whenever the playhead lands before `stopAt` (or the natural duration).
- **Esc no longer closes the video modal.** Esc was too easy to fat-finger mid-clip, and dismissing the modal loses the playback position so the presenter has to rewatch from the start. Close now requires `⌘W` / `Ctrl+W` (universal modifier-keyed close) or `PageUp` (the clicker's natural back).
- **`.prezl/` assets serve correctly on macOS.** Tauri's glob matcher follows the dotglob rule — bare `**` doesn't match path components starting with `.`, so videos and images served via the asset protocol from `.prezl/` were 403ing. Scope now covers dot-prefixed paths explicitly. Markdown loaded via the IPC command was unaffected.

## Internal

- Vite's 500 KB chunk-size warning raised to 2 MB. Shiki ships per-language / theme chunks that exceed the default; in a Tauri app there's no network transfer cost, so the warning was just noise.
- `pnpm-workspace.yaml` now allow-lists esbuild's install script. pnpm v10+ blocks postinstall scripts by default, and esbuild needs its postinstall to drop the native binary for Vite to bundle.
- Internal walkthrough for switching to Developer ID signed + notarized macOS builds checked in (`docs/internal/macos-signing.md`). Captured now to implement later — this release is still ad-hoc-signed.

## Companion VS Code extension

No companion extension change in this release. The latest published `prezl-vscode` (0.3.0) remains compatible.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.9_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.9_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.9_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.9_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.9_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Developer ID signing + notarization is documented internally and on the near-term roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.**

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
