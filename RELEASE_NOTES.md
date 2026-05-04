Seventh beta — markdown intros land as a stage-opening surface, demos gain project-wide ids that cover lists and markdown can reference, and project paths accept the `./` / `/` muscle-memory shorthands. Also: the `files/` wrapper folder is gone — `prezl.yaml` now sits next to your code.

## Breaking changes

- **`files/` wrapper dropped.** Source files now live at the project root, alongside `prezl.yaml` itself. Existing projects need to move everything under `files/` up one level (and the `.prezl/` private folder, if you have one). The Rust file walker scans from the project root directly; the manifest is hidden from the explorer.

## Highlights

- **Markdown intros.** Open a `.md` file as a stage's intro and Prezl renders it as styled markdown — GFM tables, task lists, code fences with Shiki highlighting. Drop intros under a private `.prezl/` folder at the project root and they stay out of the explorer while remaining openable. Pandoc-style image attributes (`![alt](src){.class #id width=200}`) let you size and class images without raw HTML.
- **Demo ids — cross-surface references.** Demos can declare a project-wide `id:`. Reference them from stage `cover:` lists (`demo://<id>` shorthand or `{ demo, title }` object form) and from markdown intros (`[label](demo://<id>)`). Clicking either runs the demo through the same launch path as the *Run* button. Cover rows and link affordances tick (`✓`) once the demo has been launched in scope.
- **Open-frame visited tracking for markdown links.** Link visits in markdown intros (file and demo) scope to the current "open frame," persisting across consecutive steps that inherit the stage's intro and resetting whenever a step authors its own `open:`. Cover ticks remain stage-scoped.
- **Path-leading shorthand.** Author-text paths in `open:`, `cover:`, markdown links, the project logo, and `projects[].path` accept `./foo` and `/foo` as syntactic sugar — both normalise to the same bare project-relative key, so cover ticks, visited tracking, and `file=` selectors line up regardless of which form you wrote.
- **Within-screen tab scroll restoration.** Clicking a tab inside the current screen now restores its last scroll position, matching back/forward navigation behaviour.

## Fixes

- Markdown link colour lightened for projector legibility.
- Markdown image paths resolve correctly relative to the active file (or root-relative with a leading `/`).

## Companion VS Code extension

The `prezl-vscode` companion (now 0.3.0) tracks this release: schema and parser cover demo cover entries, the demo `id:` field, and the `./` / `/` path-leading shorthand. Markdown snippets and `demo://` link awareness in the activity-bar Stages tree.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.7_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.7_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.7_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.7_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.7_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Code signing is on the roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.** This release drops the `files/` wrapper folder — projects authored against beta.6 will need their source files moved up one level.

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
