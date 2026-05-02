Sixth beta — schema rename consolidating the Run-button vocabulary on **demo**, plus a few small fixes around the demo modal and WebView caching.

## Breaking changes

- **`preview` → `demo` everywhere the Run button is concerned.** The YAML keys are now `demo:` (single object) and `demos:` (list); the old `preview:` / `previews:` names are gone. Stage status messages, store actions, and component names follow the same rename. Projects authored against beta.5 need a one-line s/preview/demo on those keys.
- **`alias:` → `id:` on stages and steps.** Mirrors the rest of the schema (`open.id`, cover items, demo titles, directive `id=`) and pairs better with the `<stageId>.<stepId>` screen vocabulary used by directive selectors. Projects authored against beta.5 need a s/alias/id on stage and step entries.

The VS Code companion's schema and Stages tree-view are updated in the same release window — bump the `prezl-vscode` extension alongside this app build to keep validation and completions accurate against the new vocabulary.

## Fixes

- **Demo picker no longer flashes a stale selection** when reopened — the highlight now resets to the first row each time the picker mounts.
- **Video scrub bar is visible on white frames.** The bar background gets a subtle contrast lift so it doesn't disappear into bright video content.
- **WebView asset cache busts across page reloads.** Reloading the app no longer serves stale bundle assets when the build artefacts have changed underneath.
- **`Ctrl+F5` triggers Run** alongside `F5` and `Ctrl+Enter`, catching the muscle-memory hard-refresh too. `Ctrl+R` still does native refresh.

## Companion VS Code extension

The `prezl-vscode` companion extension tracks this rename — `demo:` / `demos:` schema validation, completions, and the Stages tree-view all use the new keys. Bump to the matching extension release before authoring against the new vocabulary.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.6_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.6_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.6_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.6_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.6_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Code signing is on the roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.** This release renames `preview`/`previews` keys to `demo`/`demos` and `alias` to `id` on stages and steps — projects authored against beta.5 will need a small migration pass.

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
