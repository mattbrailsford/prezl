Second beta — focused on polish around the directive system, video previews, and slide-deck integration. The big new piece is `prezl://` deep links that let you launch directly into a screen from a Keynote/PowerPoint slide.

## Highlights

- **Slide-deck deep links.** Custom `prezl://open?path=…&screen=…` URL scheme lets a Keynote/PowerPoint slide launch (or focus) Prezl on a specific screen, optionally fullscreen. A "Back to presentation" affordance returns the user to the slide deck (Shift+Esc, or the top-bar button). The status bar gains register/unregister and share-link controls; share opens an options popover for picking the target screen and saving an OS-native shortcut file (`.url` / `.webloc` / `.desktop`). See [Slide-deck integration](https://mattbrailsford.github.io/prezl/guide/slide-deck-integration/).
- **Lead-with-video pattern.** Stages can `autoLaunch` a fullscreen video preview the moment the screen opens, and the modal advances to the next screen on PageDown / Space once playback hits its `stopAt` cue. Ideal for "show the demo, then walk through the code."
- **HTML and Razor directive comments.** `@prezl` directives now parse inside `<!-- … -->` and `@* … *@` single-line block comments, so Razor / Blazor / cshtml / xml / html projects work without workarounds.
- **Smarter symbol jumps.** Clicking a symbol that lives inside a collapsed fold auto-expands the containing fold(s) before scrolling, and the target line briefly flashes the accent colour so the eye catches it. Plain step advances skip the flash so they don't feel noisy.
- **Mouse back/forward navigation.** XButton1 / XButton2 (the side buttons on most mice) drive the browser-style history stack — back to the previous `(screen, file, scroll)` and forward again. Suppressed while a video preview is open so the modal owns the buttons.

## Fixes

- Clicking an explorer item or tab and then pressing Space / PageDown no longer paints a focus ring on the clicked control. The shortcut blurs the active element before advancing; Tab-driven keyboard navigation still gets a focus ring as expected.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.2_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.2_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.2_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.2_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.2_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine (a conference laptop, a borrowed workstation) without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Code signing is on the roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.** Future betas may introduce breaking changes to `prezl.yaml` or the directive grammar.

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
