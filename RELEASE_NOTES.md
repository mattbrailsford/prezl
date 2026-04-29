Fifth beta — multi-demo support with a Run picker, a presenter "agenda" list under the file tree, an ergonomic shorthand for `open:` / `cover:` targets, and a round of schema simplifications now that field semantics are settling.

## Highlights

- **Multiple demos per stage / step.** A stage or step can now declare more than one demo. The Run button lights up a small picker when the current screen has more than one (arrow keys cycle, Enter selects, Esc closes); a single demo still launches directly. Two YAML field names are accepted — `demo:` for the common one-demo case (single object), `demos:` for the explicit list form. Across a list, at most one entry may carry `autoLaunch: 'start'` and at most one `'end'`.
- **Stage cover list (presenter agenda).** A stage can declare a `cover:` list of files (and optional anchors) the presenter wants to remember to discuss while in that stage. Surfaced as a small clickable checklist under the file tree; rows tick once the file has been opened during the stage's tenure. Cover doesn't propagate across stage boundaries — each stage is its own agenda.
- **`path[#id][@line]` shorthand for `open:` and cover items.** `open: src/api.ts#fetchData` opens the file at the symbol anchor; `open: src/api.ts@42` opens at line 42; `src/api.ts#fetchData@42` does both. Cover items accept the same grammar. Suffixes peel from the rightmost separator, so npm-scoped paths (`node_modules/@types/foo.ts`) and tag-style suffixes (`@head`) round-trip cleanly.
- **F5 triggers Run.** Alongside `Ctrl+Enter`. Captured globally so the WebView's default page-refresh doesn't fire — `Ctrl+R` still does native refresh.
- **Editor tab context menu.** Right-click any tab for **Close**, **Close Others**, **Close All**. Closing tabs deliberately doesn't push to navigation history.
- **File-level focus in the explorer.** Files matched by a `@prezl file=` directive carrying `focus(=[selector])?` get a tinted leaf row on matching screens; collapsed folders containing focused descendants tint quietly without auto-expanding (and the tint drops once the folder is opened).
- **Step title in the TopBar.** Stepped stages now show the step's `title:` next to the `n / N` counter, so the audience sees what the build is showing rather than just the position.

## Polish

- **Schema simplification.** Step-to-step inheritance is gone for `demos` and `cover` — resolution is now stage→step only. An omitted step uses the stage default; `~` (YAML null) means "explicitly empty for this step." Previously the chain made trailing-video demos carry forward unintentionally; the simpler model removes the footgun. Step `open` likewise dropped its sticky chain: omitted means "no opinion" (the runtime preserves what the presenter is currently looking at), and `~` resets to `stage.open`.
- **Cover items use `title:` (not `label:`).** Matches the field name used on stages, steps, and demos — cover was the only odd one out. Demos using the old name need a one-line s/label/title/.
- **`cover:` accepts a single-item shorthand.** `cover: src/foo.ts#fetchData` is shorter than the array form for one-item agendas; mirrors `demo:` vs `demos:`.
- **Optional `title:` on demos.** Surfaced as the row label in the Run picker, so two entries that share a `src` (different cue ranges, etc.) stay distinguishable. Falls back to the URL or video basename otherwise.
- **Persistent manual fold opens within a stage.** Folds the presenter explicitly opens during a stepped build now stay open across step transitions; only crossing into a different stage re-seeds the default-collapsed set.
- **Collapse-all-folders button in the explorer header.** One click to bring the file tree back to its baseline.
- **Directive snippets for block-comment languages.** `@prezl` snippets now ship for `/* … */`-style comment hosts (CSS, SCSS, JSON-with-comments, etc.) in addition to TypeScript.

## Fixes

- Stage cover list now reveals the active file in the explorer when a row is clicked even if the file is already active. Visited tracking also clears entries that appear in a step-level cover override (so each step's framing starts fresh).
- Folder focus tint clears once the folder is expanded — its focused descendants then carry the cue themselves.

## Companion VS Code extension

The `prezl-vscode` companion extension keeps tracking the runtime schema. Beta.5 brings cover support to the activity-bar tree, the same `path[#id][@line]` parser the runtime uses, and the `title`/single-item shorthand changes. The extension ships on its own cadence — `vscode-v0.2.1` is the latest release.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.5_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.5_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.5_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.5_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.5_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Code signing is on the roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.** This release renames cover items' `label` to `title` and drops sticky-forward inheritance for `demo` / `cover` / step `open` — projects authored against beta.4 will need a small migration pass.

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
