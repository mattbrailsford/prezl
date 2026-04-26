# Prezl — Claude context

Fake-IDE desktop app for code presentations. Branches-as-stages with
optional intra-stage steps (build-style sub-navigation), inline
`@prezl` comment directives for visibility / folding / highlighting,
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
                      list_project_files, recents/preferences CRUD via
                      config_dir() (appConfigDir, or <exe-dir>/data/ when
                      the exe filename contains "portable").
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
    visibleFiles.ts     file-level `@prezl file=` filter for the explorer,
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
    useMouseHistoryNav  XButton1/2 (mouse back/forward) → goBack /
                        goForward. Capture-phase mousedown+mouseup;
                        suppressed while the video preview is open.
    useRenderedFile.ts  useScreenIndex / useCurrentScreen /
                        useCurrentStage / useVisibleFiles /
                        useSymbolTable / useActiveRenderedFile.
```

## Directive system invariants

Prefixes accepted: `@prezl` or `@przl`. Line comments (`//`, `#`, `--`)
and single-line block comments (`/* ... */`, `<!-- ... -->`, `@* ... *@`).
Directives are always on their own line and always stripped from the
rendered text.

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

Two extras layer onto every `scrollToLine` call:

- **Auto-expand containing folds.** Any fold whose range covers the
  target line (inclusive of `start`, since the start line is the fold's
  visible header — clicking a symbol on a `collapse`d type declaration
  should reveal the body, not just sit on the summary) gets its key
  removed from `collapsedFolds` before scrolling. In cross-file jumps
  the seeding effect's `setCollapsedFolds(initial)` runs first and
  collapses everything per directive defaults; our updater runs on top
  via `setCollapsedFolds(prev => prev - containing)`, so the order
  produces "defaults minus containing." When expansion happens we defer
  the actual scroll one frame (`requestAnimationFrame`) so React has
  committed the new collapsed state and the line is back in the DOM.
- **Highlight flash.** `flashLine(el)` runs `el.animate(...)` with a
  stable `Animation.id` so repeat jumps cancel any in-flight flash and
  restart cleanly. Imperative WAAPI (not a CSS class) so React's
  className diff can't strip it mid-animation. **Only fires for
  explicit jumps** — `scrollToLine` takes a `flash: boolean` and the
  `screen.open` path passes `false`, otherwise every step advance would
  flash distractingly. Colour reads `--color-app-accent` via
  `getComputedStyle` so the flash stays themed.

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

- `Space` / `PageDown` → play/pause; once the clip has hit `stopAt`,
  these close the modal so forward nav defaults to "I'm done, carry on"
- `Escape` / `PageUp` → close preview
- The Restart chip (only shown at `stopAt`) takes an explicit click —
  replaying is the rare deliberate case, not what forward nav should do.

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

## Location history

Browser-style back/forward stack of `(screenId, file)` entries. Pushed
at the end of every user-initiated nav action — `switchScreen`,
`openFile`, `setActiveFile`, `navigateToFileLine` — via the
`recordCurrent()` helper inside the store. Adjacent duplicates collapse;
a new push truncates the forward stack. `closeTab` deliberately does
not push (closing is editing, not navigating).

`goBack` / `goForward` set a closure-scoped `suppressHistoryPush`
flag and call `applyHistoryLocation(loc)`, which mirrors switchScreen's
visible-files / tab-reconcile work but **forces `activeFile` to the
recorded file** — overriding the screen's `open.file` intent, because
the user explicitly asked to return to *this* file — and **skips the
video autoLaunch** so navigating backward never replays a video.

Per-`(screen, file)` scroll positions live in a module-level
`scrollPositions: Map<string, number>` outside Zustand state. Mutated
in place from CodeView's `onScroll`; never read reactively, so it
costs zero re-renders. Cleared on `setProject` / `clearProject`.
Restoration goes through a one-shot `pendingScrollTop` field which
CodeView consumes in its scroll layoutEffect at higher priority than
`pendingNavigation` and `screen.open`. The set runs inside a
`requestAnimationFrame` so the fold-seeding effect commits first —
otherwise the saved pixel position would land on the wrong line once
default-collapsed folds shift the layout above it. The onScroll
handler suppresses saves while a `pendingScrollTop` is in flight, so
the synthetic restore doesn't immediately overwrite the value it just
read.

## Preferences storage

Persisted to `<config-dir>/preferences.json` via the `read_preferences` /
`write_preferences` Tauri commands (see `src-tauri/src/commands.rs`).
`config_dir()` resolves to `appConfigDir` by default, but switches to
`<exe-dir>/data/` when the executable's filename contains "portable"
(case-insensitive) — that's how the single-file Windows portable build
(`Prezl_<version>_x64-portable.exe`) ships state-with-binary. Recents
(`recents.json`) use the same resolver.

Hydrated on mount and debounced-written on change by
`usePreferencesPersistence`; the shape lives in `Preferences` /
`DEFAULT_PREFERENCES` in `src/types.ts` (uiScale, explorerCollapsed,
explorerWidth, autoRevealActiveFile, explorerHintShown).

## Slide-deck integration

`prezl://open?path=…&screen=…&fullscreen=1&hideOnExit=1` deep links
launch (or focus) the app, switch to a screen, and optionally surface a
"Back to presentation" affordance. End-to-end pieces:

- **Plugins.** `tauri-plugin-deep-link` (URL scheme) +
  `tauri-plugin-single-instance` with the `deep-link` feature so a
  second invocation forwards URLs to the running window. Single-
  instance must be the FIRST plugin registered (Tauri docs).
- **Rust commands.** `register_protocol` / `unregister_protocol` /
  `is_protocol_registered` wrap `DeepLinkExt`. Windows writes
  `HKCU\Software\Classes\prezl` with the absolute exe path embedded —
  per-user, no UAC. `is_portable_mode` exposes the existing filename
  detection. `return_to_presentation` exits fullscreen, then
  minimizes (Win/Linux) or `app.hide()`s (macOS — better for Keynote
  on its own Space). `save_deck_link_file` writes a clickable
  shortcut in the right format per OS (`.url` / `.webloc` /
  `.desktop`).
- **Capabilities.** `deep-link:default` only grants `get_current` —
  `register` / `unregister` / `is-registered` need their own allow
  permissions. Easy to miss; the failure mode is a generic toast.
- **Frontend.** `useDeepLink` owns boot routing: it checks the
  cold-start URL via `getCurrent()`, falls back to recent auto-open
  if none, and listens for runtime URLs via the
  `prezl://deep-link` event our setup hook emits. `BootCurtain`
  renders over everything while `isRouting` is true (default-true at
  startup, dropped after the boot useEffect resolves + 1 rAF). This
  hides every flash between Welcome / wrong-recent / correct project.
- **Status bar.** `StatusBarLinkControls` shows two icons: the
  register/unregister toggle and the share icon. Toggle visibility
  rule is `portable || !registered` — installed builds with the
  bundler-time registration intact get no toggle; everything else
  does. Plain click on share copies a link to the current screen with
  fullscreen+hideOnExit defaults; alt-click / right-click opens an
  options popover with target picker + Save shortcut button. If
  `linkBlocked` (portable + unregistered), copy refuses and toasts
  rather than putting a non-functional URL on the clipboard.
- **Top bar.** `BackToPresentationButton` mounts only when
  `launchedFromSlide` (set by the `hideOnExit=1` flag). Square icon-
  only button matched to RunButton's height; Shift+Esc keybinding is
  bound in the same component.
- **Tests.** `src/project/deepLink.test.ts` covers the URL
  parser/builder. The runtime piece isn't unit-tested — manual
  verification through Run dialog is unreliable on Windows (Run
  doesn't resolve custom schemes); use PowerShell `Start-Process
  "prezl://..."` or click a link in Edge instead.

User-facing docs live at `docs/guide/slide-deck-integration.md` and
`docs/reference/url-scheme.md`.

## Milestone status

- M1 — shell ✓
- M2 — project loading, recents, branch switching ✓
- M3 — `@prezl` directive system ✓
- M4 — fake build + URL preview ✓
- M5 — fullscreen video preview with cues ✓
- M6 — symbol navigation ✓
- M7 — symbol quick-find (Ctrl+T) ✓
- M8 — intra-stage steps (build-style sub-navigation) ✓
- M9 — slide-deck deep links + back-to-presentation ✓

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
