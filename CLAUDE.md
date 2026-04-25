# Prezl — Claude context

Fake-IDE desktop app for code presentations. Branches-as-stages with
optional intra-stage steps (build-style sub-navigation), inline
`@prezl:*` comment directives for visibility / folding / highlighting,
no real build or git. See `docs/guide` / `docs/reference` for current
behaviour, `docs/internal/design-principles.md` for the framing
(controlled illusion, code-first, presentation-safe defaults), and
`README.md` for a user-facing overview.

## Dev commands

- `pnpm tauri dev` — launch app with HMR. First launch compiles Rust (~90s);
  subsequent ones incremental.
- `pnpm typecheck` — `tsc -b --noEmit`. Fast; run before committing.
- `pnpm build` — vite frontend build only.
- `pnpm test` — Vitest (unit tests; M4+).

`pnpm tauri dev` leaves children that can outlive Ctrl-C: if a restart
fails with `port 1420 is already in use` or `failed to remove prezl.exe`,
kill the stray `node` / `prezl.exe` via PowerShell.

## The screen model

A **screen** is the addressable unit the presenter advances through.
- A stage with no `steps:` has one implicit screen, id = stage alias.
- A stage with `steps:` produces one screen per step, id = `<stageAlias>.<stepAlias>`.

Stages and steps collapse into one flat ordered list (`screenIndex.ordered`).
Space/PageDown walks this list end-to-end, including across stage
boundaries. The dropdown still lists stages only (steps are internal,
like slide builds in Keynote); selecting a stage jumps to its first
step. A step indicator (`n / N`) appears in the TopBar only for stages
with multiple screens — single-step stages look unchanged.

Step `open` and `preview` inherit **sticky-forward**: missing values
fall through to the previous step's resolved value, with the stage's
defaults seeding step 1. Once a step swaps files or previews,
subsequent empty steps stay there until the next override.

Branch reload (file contents) only happens when crossing a stage
boundary; within-stage step changes are pure parser re-runs, so they
feel snappier than stage switches.

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
  main.tsx            standard ReactDOM.createRoot — no special pre-init.
  components/
    AppShell.tsx        TopBar + Explorer + tabs + CodeView + StatusBar
    TopBar.tsx          project title (click to close project) + stage
                        dropdown + step indicator + run + window controls.
                        data-tauri-drag-region is on every non-interactive
                        element.
    StageSelector.tsx   stages-only dropdown; switchStage(alias) jumps to
                        the stage's first screen.
    StepIndicator.tsx   "n / N" within current stage; hidden for single-
                        screen stages.
    ExplorerTree.tsx    tree from useVisibleFiles(); Open Folder +
                        collapse/expand buttons in the header.
    CodeView.tsx        static read-only viewer — Shiki tokens, plain DOM
                        for line numbers / fold widgets / decorations.
                        Replaced Monaco; see "Code viewer" below.
  project/
    schema.ts           Zod validation for prezl.yaml. open: accepts a bare
                        path string (shorthand for { file, line: 1 }) or
                        the object form. Step entries accept a bare alias
                        string (shorthand for { alias }) or the object
                        form.
    loader.ts           orchestrates pickProjectFolder / load_project /
                        list_project_files / read_project_file.
    stageList.ts        screen index + selector parser. buildScreenIndex
                        produces ordered screens with step→stage open/
                        preview inheritance. parseScreenList accepts
                        bare aliases (= every screen of that stage) and
                        dotted refs (stage.step), with cross-stage ranges.
    directiveParser.ts  per-screen parse: text + foldRanges + focusRanges +
                        marks + hiddenForStage + errors. Takes a
                        currentScreenId + ScreenIndex.
    visibleFiles.ts     file-level @prezl:file filter for the explorer,
                        evaluated against the current screen.
    shikiSetup.ts       singleton highlighter + inferLanguage.
  state/
    store.ts            Zustand; setProject builds + caches the
                        ScreenIndex. switchStage(alias) is sugar for
                        switchScreen(firstScreenOf(alias)).
                        switchScreenRelative(±1) walks the flat ordered
                        list. Status "Switching to X..." only fires when
                        crossing a stage boundary.
    stageReducer.ts     pure tab reconciliation on screen switch
                        (reconcileScreenSwitch). Consumes the screen's
                        resolved open, so per-step open overrides take
                        effect.
  hooks/
    useUiScale.ts       Ctrl+=/-/wheel, Ctrl+0, persisted.
    useExplorerToggle   Ctrl+E.
    useStageShortcuts   Space / PageDown / Ctrl+Space (and inverses) —
                        walks every screen, including across stage
                        boundaries.
    useRenderedFile.ts  useScreenIndex / useCurrentScreen /
                        useCurrentStage / useVisibleFiles /
                        useSymbolTable / useActiveRenderedFile.
```

## Directive system invariants

Prefixes accepted: `@prezl` or `@przl`. Line comments (`//`, `#`, `--`)
and single-line block comments (`/* ... */`). Directives are always on
their own line and always stripped from the rendered text.

**Attribute-based grammar** — one opening tag can stack behaviours:

```ts
// @prezl id=<name>?  show=[selector]?  focus=[selector]?  collapse(=[selector])?  label="..."?
(content)
// @prezl end                // pops top of stack
// @prezl end=<name>         // must match open id; error on mismatch

// Pure anchor (no behaviours)
// @prezl id=registerDashboard

// File-level visibility (must be before any code)
// @prezl file=[shell...]
```

Selectors accept screen ids, not just stage aliases:

- `[shell]` — every screen of the shell stage
- `[shell.intro]` — exactly one screen
- `[shell.intro...preview.fetch]` — closed range, crosses stage boundaries
- `[shell...preview]` — bare aliases in a range resolve to first/last
  screen of the stage on each side
- `[shell, preview.intro]` — explicit list, mix bare and dotted

Attribute semantics:

- `id=<name>` — optional identifier. Doubles as the mark for YAML
  `open.id` to target. If the directive also opens a region, the id
  anchors the first content line inside it.
- `show=[selector]` — region is **removed** (line numbers shift) on
  screens not in the selector.
- `focus=[selector]` — whole-line decoration over the region.
- `collapse` (bare flag) — fold a region, always collapsed by default.
- `collapse=[selector]` — fold only on listed screens.
- `label="..."` — label text for the collapsed fold's placeholder. Only
  valid when `collapse` is present.
- `file=[selector]` — file-level gate; whole file absent from the
  explorer on non-matching screens. Must appear before any code.
  Cannot combine with other attributes.

The collapse fold's `start` is the first content line (so the summary
reads `type Foo = { … }` inline) and `end` is the last content line.

Outer wins: if an outer `show` drops a region, nested `collapse`/`focus`
never fire.

## Code viewer

`CodeView.tsx` is a static, read-only HTML viewer — no editor library.
Tokens come from Shiki (singleton in `shikiSetup.ts`); everything else
(line numbers, fold widgets, focus highlights, click-to-jump symbol
spans) is plain DOM.

Why no Monaco: the previous Monaco wrapper was ~2.5 MB of editor for
features we explicitly turned off (IntelliSense, hover, cursor, etc.).
Cold start showed a black screen until the editor mounted; stage
switches needed a `visibility: hidden` flicker-prevention dance because
Monaco's FoldingController cached models we couldn't easily invalidate.
Static HTML rendering eliminates both — content is visible the moment
the parser produces a `RenderedFile`, and screen switches are a normal
React re-render.

**Tokenization is async-but-cheap.** First `getHighlighter()` resolves
the Shiki bundle (~150–250 KB; per-language grammars lazy-load on
demand). Until tokens arrive, the viewer renders the raw text without
colours — readable and never blank. After resolution, subsequent
tokenizations are synchronous.

**Folding state is local to CodeView.** A `Set<string>` of fold keys
(`${start}-${end}`) is re-seeded from `RenderedFile.foldRanges` on
every `(file, screen)` change, so directive-driven default-collapsed
folds always win on every step transition (not just stage ones). The
presenter can toggle live; that toggle survives until the next
screen/file switch.

**Symbol decorations are inline.** `useSymbolTable` returns a `Map<id,
{file, line}>`. The renderer walks each line's Shiki tokens and, for
any token whose text contains a known id at a word boundary, splits the
token to wrap the match in a `.prezl-symbol` span with `data-target-*`
attrs. The definition site is skipped. A single click handler at the
container delegates jumps via `navigateToFileLine`.

**Scroll handling.** A `useLayoutEffect` scrolls the target line into
view before paint on `(file, screen, pendingNavigation)` change.
Priority: `pendingNavigation` > `screen.open.id` > `screen.open.line` >
top of file. The `screen.open` is the resolved value (step override
wins over stage default), so per-step opens drive scroll.

**Keyboard shortcuts in capture phase.** Global shortcuts (zoom,
Ctrl+E, Ctrl+Enter, Ctrl+T, screen navigation) register with
`{ capture: true }` so any focused control can't claim them first.

**Screen navigation uses presenter-remote conventions:**

| | Next screen | Prev screen |
| --- | --- | --- |
| Bare | Space | Shift+Space |
| Clicker | PageDown | PageUp |
| Legacy | Ctrl+Space | Ctrl+Shift+Space |

`useStageShortcuts` (named for legacy reasons; semantics are
screen-walking now) skips the handler when focus is on a real
text-typing control (contentEditable, `<input>` / `<textarea>`) — keeps
typed Space working there. Buttons and selects fall through, so Space
still advances even if focus is on an explorer item.

**Video modal absorbs the clicker too.** While the video preview is
open, `useStageShortcuts` explicitly skips (`preview.kind === 'video'`),
and the modal's own capture-phase handler intercepts:

- `Space` / `PageDown` → play/pause (or Restart when at `stopAt`)
- `Escape` / `PageUp` → close preview

So with the same remote, PageDown drives playback inside the video and
drives screen navigation outside; PageUp closes the video or walks
backward a screen.

**Debugging the parser.** `useActiveRenderedFile` logs the parsed
`RenderedFile` (text, foldRanges, focusRanges, marks, hiddenForStage,
errors) to the console on every parse, keyed by screen id. Compare
against what the viewer actually renders if behaviour looks wrong.

For parser-only questions, the Vitest suite covers the pure logic
directly:

- `src/project/stageList.test.ts` — screen index build + selector grammar
- `src/project/directiveParser.test.ts` — full directive parsing
- `src/project/visibleFiles.test.ts` — file-level gate filter
- `src/state/stageReducer.test.ts` — tab reconciliation

Add a failing case to the relevant `.test.ts` file and run
`pnpm test` (one-shot) or `pnpm test:watch` (TDD loop). Prefer this
over ad-hoc debug scripts.

## Preferences storage

Currently in `localStorage` under `prezl.preferences.v1`. Planned to
migrate to `appConfigDir/preferences.json` alongside `recents.json`
before v1 ships — scope it in when a Rust command for that file lands.

## Milestone status

- M1 — shell ✓
- M2 — project loading, recents, branch switching ✓
- M3 — `@prezl:*` directive system ✓
- M4 — fake build + URL preview ✓
- M5 — fullscreen video preview with cues ✓
- M6 — symbol navigation ✓
- M7 — symbol quick-find (Ctrl+T) ✓
- M8 — intra-stage steps (build-style sub-navigation) ✓

## Symbol navigation

Implicit: no `symbols:` section in YAML. Any `@prezl id=<name>` directive
becomes a named anchor, and `useSymbolTable` builds a project-wide
`Map<id, { file, line }>` from every visible file's parsed marks on the
current screen.

`CodeView` scans the active file's rendered text for word-boundary,
case-sensitive occurrences of each id and wraps them in `.prezl-symbol`
spans (dotted accent underline; solid + pointer on hover). The
definition site itself is skipped. Each wrapped span carries
`data-target-file` / `data-target-line` so a single click handler at
the container can resolve clicks into `navigateToFileLine` calls.

**Plain click navigates.** No modifier needed — the viewer is
read-only so there's no cursor placement to preserve. Right/middle
click is left alone. `navigateToFileLine` in the store opens the
target as a tab, sets `activeFile`, and drops a one-shot
`pendingNavigation` scroll target that the viewer's layout effect
consumes before falling back to `screen.open`.

Collisions: if two marks share an id, the first one encountered in
`visibleFiles` order wins. Stale matches on common short words (`config`,
`i`) are possible but rare for a curated presentation — pick distinctive
ids. Future escape hatch would be an explicit `linkable=false` attribute,
not yet needed.

`Ctrl+T` opens the **Symbol Finder** modal: fuzzy search over the
current screen's symbol table, arrow keys cycle results, Enter jumps,
Esc closes.

**Watch for hook-ordering bugs in modal components.** The SymbolFinder
modal initially returned `null` when closed and then declared another
`useEffect` below that early return — React saw a different hook count
across renders and crashed the whole tree, blanking the UI. ALL hooks
must come before any early return.

## Demo fixture

`examples/demo/` — the four-stage project with one stepped stage. Use
it to verify behaviour after changes:

- `main`: only `main.ts` + `framework.ts` in the explorer.
- `shell`: `dashboard.ts` appears; `registerDashboard` is the focus
  highlight.
- `preview` (3 steps — `intro` / `fetchImpl` / `chartHelpers`):
  - `preview.intro` — `dashboard.ts` open at `registerDashboard`,
    focus on `render()`. `Chart rendering helpers` collapsed at the
    bottom.
  - `preview.fetchImpl` — file swaps to `api.ts` via per-step `open`,
    focus on `fetchDashboardData`. URL preview still Run-able (sticky
    inheritance).
  - `preview.chartHelpers` — file back to `dashboard.ts` via per-step
    `open`, scrolls to `renderCharts`. The `Chart rendering helpers`
    fold expands and is focus-highlighted; an inner `show=
    [preview.chartHelpers]` comment block becomes visible.
- `demo`: everything visible, no focus (preview's focus selectors
  don't match this stage's screen).

Switching screens should re-apply folds and never show a flash.
