Third beta — focused on the video preview system. Adds a "trail with video" pattern alongside the existing lead-with-video, and an inheritance escape hatch for steps that want to drop a sibling's preview override.

## Highlights

- **Trail-with-video (`autoLaunch: end`).** Stages and steps can now declare a video preview that fires at the *end* of its scope, not just the start. When the presenter forward-advances out of the screen, the screen advance pauses, the video plays, and a carry-on close (Space at the `stopAt` cue, or Space when the video ends naturally) closes the modal and advances the deck in the same press — no extra keypress. Esc / PageUp / the X button still close without advancing, in case you want to back out. The boolean shorthand `autoLaunch: true` continues to mean `start`. See [Previews → Auto-launch](https://mattbrailsford.github.io/prezl/guide/previews/).
- **Preview/open reset shorthand for steps.** A step can now say `preview: ~` (YAML null) to drop whatever step-level override is sticky-inheriting forward and revert to the **stage's** preview. Same shape works for `open: ~`. Useful when one step introduces a trailing-video preview and a later step in the same stage should fall back to the stage's plain preview rather than carry the override forward. The reset also restarts the sticky chain, so subsequent empty steps inherit the reset value, not the original override.

## Fixes

- A trailing video declared on a stage no longer re-fires on every step's forward-advance inside that stage. It now fires exactly once, on forward-leaving the last screen still showing the preview — symmetric with how `autoLaunch: start` fires on the first screen where a preview newly appears.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.3_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.3_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.3_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.3_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.3_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Code signing is on the roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.** Future betas may introduce breaking changes to `prezl.yaml` or the directive grammar.

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
