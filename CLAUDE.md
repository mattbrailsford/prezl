# Prezl — Claude context

Fake-IDE desktop app for code presentations. Branches-as-stages, inline
`@prezl:*` comment directives for visibility / folding / highlighting, no
real build or git. See `docs/prezl_product_spec.draft.md` for the full spec
and `README.md` for a user-facing overview.

## Dev commands

- `pnpm tauri dev` — launch app with HMR. First launch compiles Rust (~90s);
  subsequent ones incremental.
- `pnpm typecheck` — `tsc -b --noEmit`. Fast; run before committing.
- `pnpm build` — vite frontend build only.
- `pnpm test` — Vitest (unit tests; M4+).

`pnpm tauri dev` leaves children that can outlive Ctrl-C: if a restart
fails with `port 1420 is already in use` or `failed to remove prezl.exe`,
kill the stray `node` / `prezl.exe` via PowerShell.

## Architecture at a glance

```
src-tauri/          Rust shell (Tauri 2)
  src/commands.rs     load_project, read_project_file (scoped to <root>/files),
                      list_project_files, recents CRUD in appConfigDir.
  src/lib.rs          plugin registration + invoke_handler wiring.
  capabilities/       Explicit window permissions (start-dragging, minimize,
                      toggle-maximize, close, is-maximized, dialog:open).
                      core:default does NOT include window-mutating ops.

src/
  App.tsx             auto-opens most-recent project if still valid; else
                      renders WelcomeScreen.
  main.tsx            calls initMonaco() BEFORE React renders — see below.
  components/
    AppShell.tsx        TopBar + Explorer + tabs + CodeEditor + StatusBar
    TopBar.tsx          project title (click to close project) + branch
                        dropdown + run + window controls. data-tauri-drag-
                        region is on every non-interactive element.
    ExplorerTree.tsx    tree from useVisibleFiles(); Open Folder +
                        collapse/expand buttons in the header.
    CodeEditor.tsx      Monaco wrapper. Subtle — see gotchas.
  project/
    schema.ts           Zod validation for prezl.yaml.
    loader.ts           orchestrates pickProjectFolder / load_project /
                        list_project_files / read_project_file.
    stageList.ts        [a], [a, b], [a...b], [a...], [...b], mixed.
    directiveParser.ts  per-stage parse: text + foldRanges + focusRanges +
                        marks + hiddenForStage + errors.
    visibleFiles.ts     file-level @prezl:file filter for the explorer.
    monacoSetup.ts      Monaco init + folding-provider lockdown.
  state/
    store.ts            Zustand; setProject / switchBranch etc.
    branchReducer.ts    pure tab reconciliation on branch switch.
  hooks/
    useUiScale.ts       Ctrl+=/-/wheel, Ctrl+0, persisted.
    useExplorerToggle   Ctrl+E.
    useBranchShortcuts  Ctrl+Space / Ctrl+Shift+Space.
    useRenderedFile.ts  useActiveRenderedFile / useVisibleFiles selectors.
```

## Directive system invariants

Comment prefixes accepted: `@prezl:` or `@przl:`. Line comments (`//`,
`#`, `--`) and single-line block comments (`/* ... */`). Directives are
always on their own line and always stripped from the rendered text.

- `@prezl:file [stages]` — must be within the first non-content lines;
  errors if placed after actual code.
- `@prezl:show [stages]` / `@prezl:/show` — region is **removed** (line
  numbers shift) on stages not in the list.
- `@prezl:collapse [stages?] [label?]` / `@prezl:/collapse` — Monaco fold.
  `fold.start = renderedLine + 1` (first content line), `end` = last
  content line. Monaco renders `{ ... }` pairs inline, so the fold's
  summary is the brace line.
- `@prezl:focus [stages]` / `@prezl:/focus` — whole-line decoration.
- `@prezl:mark name` — named anchor for YAML `open.mark`. Resolves to the
  next emitted line.

Outer wins: if an outer `show` drops a region, nested `collapse`/`focus`
never fire.

## Monaco gotchas

**Folding provider must be locked down before any editor mounts.** The
bundled TypeScript language service registers its own bracket-aware
folding provider lazily. If ours isn't the only one when a TS model
materialises, Monaco merges both sets of ranges and you get duplicate
fold toggles in the gutter.

`src/main.tsx` calls `initMonaco()` (from `src/project/monacoSetup.ts`)
*before* `ReactDOM.render`. That function patches
`monaco.languages.registerFoldingRangeProvider` to a no-op after
stashing the original in `monaco.__prezlRegisterFolding`. CodeEditor
uses the stashed original to register ours exclusively.

**HMR cannot un-register already-registered providers.** If you change
Monaco-related code, a full window restart is required for changes to
take effect — HMR will load the new code, but any Monaco provider
that was registered in the previous session is still in memory.

**Auto-fold timing.** CodeEditor awaits Monaco's
`FoldingController.getFoldingModel()` (a promise that resolves once the
region tree is built from our provider) rather than guessing with
requestAnimationFrame. Then `foldingModel.toggleCollapseState(regions)`
collapses our ranges.

**Flash prevention.** CodeEditor derives a `ready` flag from
`fileStageKey === lastFoldedKey`. When the file or stage changes, `ready`
flips to false in the same render that feeds Monaco new content, so
`visibility: hidden` lands before Monaco paints. Ready flips back after
folds + scroll land.

**Keyboard shortcuts in capture phase.** Monaco installs its own
keydown/wheel handlers. We register global shortcuts (zoom, Ctrl+E,
Ctrl+Space) with `{ capture: true }` so they fire before Monaco can
swallow them — required for Ctrl+MouseWheel to zoom while hovering the
editor.

## Preferences storage

Currently in `localStorage` under `prezl.preferences.v1`. Planned to
migrate to `appConfigDir/preferences.json` alongside `recents.json`
before v1 ships — scope it in when a Rust command for that file lands.

## Milestone status

- M1 — shell ✓
- M2 — project loading, recents, branch switching ✓
- M3 — `@prezl:*` directive system ✓
- M4 — fake build + URL preview (next)
- M5 — fullscreen video preview with cues
- M6 — symbol navigation
- M7 — symbol quick-find (Ctrl+T)

## Demo fixture

`examples/demo/` — the spec §21 four-branch project. Use it to verify
behaviour after changes:

- `main`: only `main.ts` + `framework.ts` in the explorer.
- `shell`: `dashboard.ts` appears; `registerDashboard` is the focus
  highlight.
- `preview`: `api.ts` appears; `render()` + `fetchDashboardData` focused;
  `Dashboard config types` and `Chart rendering helpers` are
  collapsed-by-default.
- `demo`: everything visible, no focus (preview's focus doesn't match).

Switching branches should re-apply folds and never show a flash.
