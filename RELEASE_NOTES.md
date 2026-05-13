Eighth beta — a small follow-up to beta.7. `projects:` is now treated as an inclusion list (files outside declared projects are hidden, not shoved into a catch-all), and Tauri's JS API now matches the Rust crate version.

## Breaking changes

- **`projects:` is an inclusion list.** Files that match no declared project are now dropped from the explorer instead of appearing under a synthetic `Files` catch-all group. If you've enumerated the parts of your solution, you're orchestrating what shows on screen — stray root-level files like READMEs or lockfiles shouldn't sneak in next to the things you actually want to talk about. Authors who want a flat tree should omit `projects:` entirely.

## Internal

- `@tauri-apps/api` bumped to 2.11.0 to match the Rust-side `tauri` 2.11.1 — clears the version-mismatch warning at dev-server startup.

## Docs and examples

- README status list refreshed with recent betas, screenshot updated.
- Markdown intros docs reframed as broader markdown rendering — the page now covers the rendering surface itself, with intros as the headline use case rather than the whole subject.
- `dotnet-solution` example moved off the `files/` wrapper that was dropped in beta.7.

## Companion VS Code extension

No companion extension change in this release. The latest published `prezl-vscode` (0.3.0) tracks beta.7 and remains compatible.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.8_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.8_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.8_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.8_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.8_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Code signing is on the roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.** This release changes how `projects:` selects files — projects that relied on the `Files` catch-all group will need to either omit `projects:` or extend it to cover the previously-stray paths.

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
