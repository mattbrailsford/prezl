**The clarity of slides. The context of real code.**

This is the first public beta of Prezl — a fake-IDE desktop app for code presentations. It looks and feels like a lightweight IDE, but it's controlled like a presentation: code is explorable only within curated boundaries, and you advance through your talk one stage (or step) at a time.

## Highlights

- **Tauri 2 desktop app** with custom window chrome on Windows, macOS, and Linux.
- **Static, read-only code viewer** powered by Shiki — VS Code–grade syntax highlighting with none of the heft of a real editor.
- **Stages and steps.** Stages are the addressable units of a talk (often visualised as git branches); steps are build-style sub-navigation within a stage, the way a slide fades in bullets one at a time.
- **`@prezl` directive system.** Colocate visibility (`show`), focus highlights (`focus`), folding (`collapse`), labels, and file-level gates (`file`) inline with the code. Selectors can target a stage, a single step (`stage.step`), or a range across stages.
- **Fake build + URL preview.** Click *Run* to open a configured URL in the default browser — no actual build or git operations behind the scenes.
- **Fullscreen video preview** with pause cues for talking over playback, driven by the same Space/PageDown remote you use to advance the talk.
- **Symbol navigation.** Click any `@prezl id=…` reference to jump to its definition; `Ctrl+T` opens a Rider-style fuzzy symbol finder.
- **Presentation-friendly chrome.** `Ctrl+=` / `Ctrl+-` / `Ctrl+0` / `Ctrl+MouseWheel` zoom, `Ctrl+E` to hide the explorer, `F11` for fullscreen — all persisted across sessions.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.1_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.1_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.1_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.1_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.1_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice if you want to demo Prezl on someone else's machine (a conference laptop, a borrowed workstation) without leaving anything behind — both run from any folder and need no admin rights. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Code signing is on the roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.** Future betas may introduce breaking changes to `prezl.yaml` or the directive grammar.

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
