Fourth beta — explorer/tab UX rework, a stage-level reset flag, an "empty editor by default" UX shift, video scrubbing, and the first cut of a companion VS Code extension for authoring `@prezl` directives.

## Highlights

- **Stage reset flag.** Stages can now declare `reset: true` to re-ground the workspace on cross-stage entry — tabs collapse back to the resolved `open` file, and presenter-driven explorer expansions get trimmed (deliberate collapses survive). Step transitions inside the stage and back-nav don't trigger the reset.
- **Empty editor pane by default.** Stages no longer auto-fall-back to the first explorer file when no `open:` is declared. Omit it (or set it to `~`) to leave the editor blank with a faded brand mark — the default first-stage UX is now "just the file tree." The tab strip hides itself when the pane is empty.
- **Reworked tab strip and explorer.** Cleaner visuals throughout, plus edge-fade indicators on the tab strip. User-collapsed explorer groups now persist across stage switches and resets, instead of being forced back open by every nav.
- **Drag-to-scrub video previews.** Drag horizontally across the video preview to scrub relative to the current playhead — useful for landing on a specific frame mid-clip without committing to a `stopAt` cue.
- **VS Code extension (preview).** A companion extension that knows about `@prezl` directive syntax — see [Authoring with VS Code](https://mattbrailsford.github.io/prezl/guide/vscode-extension/). Ships on its own release cadence and is **not** bundled with this download.
- **.NET project files.** File-type icons and Shiki language mappings for `.cs` / `.csproj` / `.sln` / etc., so .NET demos look right out of the box.

## Polish

- **Labeled `collapse` folds render as comment placeholders.** When a `collapse` directive carries `label="…"`, the entire folded block hides and a single synthetic comment line (in the file's own comment syntax) stands in for it at the directive line's indent — no more italic styling bleeding into code.
- **Bare `focus` flag.** `// @prezl focus` (no selector) is now an always-on highlight across every screen.
- **Reveal scroll has a no-op band.** Animated reveal targets the top 15% of the viewport, with a no-op band so small jumps don't shuffle content unnecessarily.
- **Smoother step navigation through one file.** When a step advances inside the same file with no scroll opinion of its own, the previous scrollTop is preserved instead of snapping to the top.
- **Ctrl+T picker is filtered.** Pure section anchors (ids that exist only as scroll targets, with no clickable occurrence in code) drop out of the picker.
- **Non-UTF-8 files surface in the explorer.** Binary files now appear with a placeholder rather than vanishing entirely.
- **`prezl.yml` accepted.** The manifest loader now tries `.yaml` first and falls back to `.yml`.
- **Bare-string `open:` shorthand drops the implicit `line: 1`.** A bare path now preserves scrollTop when the file is unchanged across the screen switch, matching the object-form behaviour.
- **Project-overridable top-left logo.** Projects can ship their own logo for the title chrome.
- **`prezl://` deep-link details.** Various polish to the slide-deck integration affordances.

## Fixes

- Trailing video focus ranges no longer pick up blank lines.
- Hero mockup on the marketing site no longer mis-scales or mis-centers on mobile.

## Install

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `Prezl_0.1.0-beta.4_x64-setup.exe` | NSIS installer |
| Windows (portable) | `Prezl_0.1.0-beta.4_x64-portable.exe` | Single self-contained exe — drop it anywhere and run, state lives in a `data/` folder next to it |
| macOS | `Prezl_0.1.0-beta.4_universal.dmg` | Universal binary (arm64 + x86_64) |
| Linux | `Prezl_0.1.0-beta.4_amd64.AppImage` | Portable, no install required |
| Linux | `Prezl_0.1.0-beta.4_amd64.deb` / `.rpm` | Distro packages |

The portable Windows exe and the Linux AppImage are the right choice for demoing Prezl on someone else's machine without leaving anything behind. The portable Windows build keys off its filename: keep "portable" in the name and state stays next to the exe; rename it to `Prezl.exe` and it falls back to `%APPDATA%`.

## Known limitations

- **Builds are unsigned.** Windows SmartScreen will warn on first run; click *More info → Run anyway*. macOS Gatekeeper will block first launch — right-click the app and choose *Open*, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`. Code signing is on the roadmap.
- **No auto-update.** Each release is a fresh download.
- **API and YAML schema are not yet stable.** Future betas may introduce breaking changes to `prezl.yaml` or the directive grammar.

## Documentation

- User guide: <https://mattbrailsford.github.io/prezl/>
- Source: <https://github.com/mattbrailsford/prezl>
