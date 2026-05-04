# Prezl — Claude context

Fake-IDE desktop app for code presentations. Branches-as-stages with
optional intra-stage steps (build-style sub-navigation), inline
`@prezl` comment directives for visibility / folding / highlighting,
no real build or git. See `docs/guide` / `docs/reference` for current
behaviour, `docs/internal/design-principles.md` for the framing
(controlled illusion, code-first, presentation-safe defaults), and
`README.md` for a user-facing overview.

## Companion: VS Code extension

`vscode-extension/` ships authoring support for the same scheme the app
consumes. Any change to the prezl scheme **must** be mirrored there in
the same change — otherwise authors get stale validation, completions,
or syntax highlighting against directives the runtime now accepts (or
rejects). Touch points:

- **`prezl.yaml` schema** — `vscode-extension/schemas/prezl-yaml.schema.json`
  must track every field added/removed/retyped in `src/project/schema.ts`
  (stage/step keys like `open`, `demo`, `cover`, `reset`, `steps`,
  shorthand forms, tri-state `null` resets, etc.).
- **Directive grammar** — `vscode-extension/syntaxes/prezl-directive.injection.json`
  (TextMate injection) and `vscode-extension/src/directiveIndex.ts` /
  `scanner.ts` parse the same `@prezl` / `@przl` directives as
  `src/project/directiveParser.ts`. New attributes, selector forms, or
  prefixes need updates on both sides.
- **Snippets** — `vscode-extension/snippets/prezl.code-snippets` and
  `prezl-block.code-snippets`. If a new directive shape is worth
  authoring, add a snippet too.
- **Stages view** — `vscode-extension/src/views/` reads `prezl.yaml` to
  build the activity-bar tree; new stage-level fields that affect
  navigation (e.g. steps, cover) may need surfacing here.

Bump `vscode-extension/package.json` `version` when shipping a
user-visible scheme change so the marketplace picks it up via the
`vscode-v*` release pipeline (see the `vscode-release` skill).

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
- A stage with no `steps:` has one implicit screen, id = stage id.
- A stage with `steps:` produces one screen per step, id = `<stageId>.<stepId>`.

Stages and steps collapse into one flat ordered list (`screenIndex.ordered`).
Space/PageDown walks this list end-to-end, including across stage
boundaries. The dropdown still lists stages only (steps are internal,
like slide builds in Keynote); selecting a stage jumps to its first
step. A step indicator (`n / N` plus the step's `title` / id if
set) appears in the TopBar only for stages with multiple screens —
single-step stages look unchanged.

Step `demos` and `cover` resolve **stage→step only** — there's no
step-to-step chain. Each step independently uses the stage default
unless it declares its own:

- `undefined` (omitted) → use the stage's `demos` / `cover`
- explicit `null` (`~` in YAML) → explicitly empty (this step has none
  even if the stage does); resolves to `undefined` at the screen level
- value → use as-is

Reference identity is preserved across consecutive inherited steps —
`buildScreenIndex` hands the same stage list reference to each — which
is what the autoLaunch logic and visited-tracking key off. So an
inherited demo list doesn't re-fire `autoLaunch: 'start'` on every
step, and an inherited `cover` doesn't reset visited tracking.

Step `open` is also tri-state but **does not** sticky-forward across
omitted steps:

- `undefined` (omitted) — step 1 seeds from `stage.open` (entering the
  stage IS the author's "land here" intent); subsequent omitted steps
  resolve to `undefined` so the reducer treats them as "no opinion."
  The reducer's prior-active-file rule keeps the file active without
  force-reopening it, so a presenter-initiated close (or any other
  manual editor change) survives the step transition.
- `null` — reset to `stage.open` (which itself may be a value, `null`,
  or `undefined`).
- partial (`{ id }` / `{ line }` with no `file`) — fill `file` from the
  most recent resolved open that had one, tracked separately via
  `prevOpenWithFile` so an authored partial after an omitted gap still
  has a target file.
- value — use as-is.

Branch reload (file contents) only happens when crossing a stage
boundary; within-stage step changes are pure parser re-runs, so they
feel snappier than stage switches.

## Demos (Run button)

A stage or step declares demos via one of two YAML keys:

- `demo:` — single object shorthand (one demo)
- `demos:` — explicit array (zero or more)

Both are accepted; using both on the same stage/step is a parse-time
error (`preventBothDemoFields` superRefine). The loader's
`resolveDemoField` normalises whichever the author wrote into a
single internal `Stage.demos` / `Step.demos` of type
`Demo[] | null | undefined`. The runtime exposes
`Screen.demos: Demo[] | undefined`. Two invariants on the
resolved list, enforced at parse time:

- ≤1 entry with `autoLaunch: 'start'`
- ≤1 entry with `autoLaunch: 'end'`

Each entry may carry an optional `title:` string. The picker uses it as
the row label (with the URL or video basename as fallback), so two
entries that share a `src` can still be distinguished at the moment of
selection.

Run button behaviour (also wired into Ctrl+Enter, F5, and Ctrl+F5 —
F5 keeps presenter-clicker compatibility; Ctrl+F5 catches the muscle-
memory hard-refresh; Ctrl+R still does native refresh):

- Empty list → button disabled, status toast "No demo configured".
- Exactly one → launch directly (URL demo opens externally; video
  demo opens the modal).
- More than one → set `demoState` to `{ kind: 'picker', demos }`,
  which mounts `DemoPicker`. The picker is a SymbolFinder-style
  modal: arrow keys cycle, Enter selects, Esc / click-outside closes.
  The selected demo routes through `runDemo(chosen)`, which
  bypasses the picker check and goes straight to launching.

Only one demo is ever active at a time. The store's `runDemo`
guards against re-entry while a modal is up. Opening another demo
via picker selection only succeeds because the picker is itself a
non-launched state — selection transitions `picker` → `launching` →
`video` / closed.

`autoLaunch` firing rules use the (single-by-invariant) entry of each
mode, scanned per screen via `findAutoLaunchVideo(screen, mode)`:

- **start**: fires on cross-screen entry when the target's autoStart
  entry differs by reference from the previous screen's autoStart entry
  (or the previous screen had none) AND we're moving forward. Same
  entry across screens means "still in scope", so a stage-level
  autoStart demo doesn't relaunch on each step inside the stage.
- **end**: fires on forward-advance out of a screen when the current
  screen has an autoEnd entry whose reference differs from the next
  screen's autoEnd (or the next screen has none) AND
  `lastEndAutoLaunchedScreenId` doesn't match — the latter prevents
  the immediate "advance after watching" press from re-firing the
  trailing video. Deck-advance on close is gated on the modal having
  been opened via autoLaunch=end (`demoState.trailing === true`); a
  manual Run-launch of a demo that happens to have `autoLaunch:
  'end'` does NOT advance the deck on close.

The demoState `picker` variant absorbs Space/PageDown/PageUp the
same way the video modal does — `useStageShortcuts` checks for both
`'video'` and `'picker'` and bails. So screen nav doesn't bleed
through behind the picker.

## Stage reset

A stage with `reset: true` re-grounds the workspace **only on cross-
stage entry** (forward or via dropdown — *not* on back-nav, and *not*
on step transitions within the stage). Two effects:

- Tabs collapse to the resolved `open` file via the stage-reset
  variant of `reconcileScreenSwitch`.
- Explorer expansion is reset *monotonically toward less clutter*:
  the new expanded set is `(prev ∩ baseline) ∪ activeFileChain`. So
  presenter-driven expansions beyond the project's default get
  re-collapsed, but presenter-driven *collapses* survive — the reset
  honors deliberate hides instead of undoing them. The active file's
  chain (group + folder ancestors via `ancestorChainForFile`) is the
  only forced-open exception, since the tab would otherwise point at
  hidden content. The store fires the reset by bumping
  `explorerResetToken`; ExplorerTree's reset effect keys on that.

## Stage cover (presenter agenda)

A stage can declare a `cover:` array of items the presenter wants to
remember to surface during that stage. Surfaced as a small clickable
list under the file tree (`StageCoverList`). Two shapes (discriminated
union — `kind: 'file' | 'demo'` after parse):

- **File entries** — a path with optional `#id` / `@line`. Tick once
  the file has been opened during the current stage's tenure.
- **Demo entries** — a `demo://<id>` reference resolved against the
  same project-wide `demosById` index markdown intros use. Click
  fires `runDemo` (same launching path as the Run button / picker /
  markdown demo link). Tick once the demo id has been launched in
  this stage's tenure (any launch site counts: cover row, Run button,
  picker selection, markdown link, autoLaunch start/end). Unresolved
  ids render muted with a ⚠ — visible authoring mistake without
  breaking the agenda; click is a no-op.

Authoring shorthand for files: `path[#id][@line]` mini-grammar (parsed
by `parseTargetShorthand` in `schema.ts`) — either suffix optional,
either order. Object form `{ file, id?, line?, title? }` covers what
shorthand can't. Authoring shorthand for demos: `demo://<id>` (mirrors
markdown's link grammar) or `{ demo: '<id>', title? }` object form.
Single-item shorthand: a bare string/object is equivalent to a
one-element list — mirrors the `demo:` / `demos:` pair. See
`docs/reference/yaml-schema.md` for the full grammar.

Steps may override the stage cover list with a step-level `cover:` —
same stage→step resolution as `demos` (omit → stage default, `~` →
explicitly empty, value → use it; no step-to-step chain). `open`
shares the tri-state shape but its omitted-step semantics are
different — see "The screen model". Cover does **not** propagate
across stage boundaries; each stage is its own agenda.

Visited tracking has two parallel sets on the store:

- `visitedFilesInStage: Set<string>` — file paths visited during the
  current stage. Added to whenever `activeFile` changes (via
  `switchScreen`, `openFile`, `setActiveFile`, `navigateToFileLine`,
  and the back/forward `applyHistoryLocation` path).
- `launchedDemosInStage: Set<string>` — demo ids launched during the
  current stage. Added to from every site that flips `demoState`
  into a launching/showing form (`runDemo`'s `launching` transition,
  the autoLaunch start hook in `switchScreen`, and the trailing-end
  hook in `switchScreenRelative`), plus seeded by the initial
  autoLaunch on `setProject`.

Both sets reset on every cross-stage entry (forward, back, dropdown).
When stepping within a stage, a step transition whose cover *reference*
differs from the previous step's clears any visited entries that appear
in the new cover (files filtered against `kind: 'file'` items, demo
ids filtered against `kind: 'demo'` items) so each step's framing
re-prompts. Items visited under the previous step that aren't on the
new cover stay ticked. Stage→step resolution preserves cover identity
across steps that don't override, so the common "every step shares the
stage cover" case never triggers a reset.

File click routes through `navigateToFileLine` when the cover item
resolves an `id` against the current symbol table, otherwise falls
back to `openFile`. Demo click routes through `runDemo(demosById.get(
demoId))` — bypasses the picker because the user already chose by
clicking this row.

A second visited set, `visitedFilesInOpen`, drives **markdown link
ticks** under a separate invalidation policy. Same population (any
`activeFile` change) but resets on a different boundary: the open-
frame reference. Each screen carries `openIdentity` alongside
runtime `open`. `openIdentity` always inherits from `stage.open`
when a step omits/`null`s its open — including non-first steps,
where runtime `open` deliberately drops to `undefined` to preserve
presenter actions. So consecutive inheriting steps share a stable
reference (no markdown-link reset), and a step that authors its own
`open` gets a fresh reference (full reset of `visitedFilesInOpen` on
that transition). Cross-stage transitions full-reset both sets.
This keeps cover ticks stable across stage-level cover sharing while
letting markdown intros re-prompt link visits whenever a step shifts
the framing.

## Architecture at a glance

```
src-tauri/          Rust shell (Tauri 2)
  src/commands.rs     load_project, read_project_file (binary-safe:
                      non-UTF-8 returns null → LoadedProject.binaryFiles
                      not rawFiles, so the explorer still surfaces them),
                      list_project_files, recents/preferences CRUD via
                      config_dir() (appConfigDir, or <exe-dir>/data/ when
                      exe filename contains "portable" — see "Preferences").
  capabilities/       Explicit window permissions; core:default does NOT
                      include window-mutating ops. Deep-link allow list
                      needs explicit register / unregister / is-registered.

src/
  App.tsx             auto-opens most-recent project if valid; else
                      WelcomeScreen.
  components/         AppShell, TopBar (data-tauri-drag-region on every
                      non-interactive element), StageSelector,
                      StepIndicator, ExplorerTree (header: Open Folder +
                      Collapse-All-Folders + Hide-Explorer; group-header
                      state preserved on collapse-all), CodeView,
                      EditorTabs, StageCoverList, BackToPresentationButton,
                      BootCurtain, demo/ (DemoPicker, VideoDemo),
                      etc.
  project/            schema.ts (Zod for prezl.yaml/.yml — loader tries
                      .yaml first; tri-state open/demos/cover — see
                      "The screen model"), loader.ts (load_project +
                      file-list + read orchestration), stageList.ts
                      (buildScreenIndex with step→stage open/demo
                      inheritance, parseScreenList for bare/dotted/range
                      selectors), directiveParser.ts (per-screen parse:
                      text + foldRanges + focusRanges + marks +
                      hiddenForStage + errors), visibleFiles.ts (`file=`
                      filter), shikiSetup.ts (singleton highlighter +
                      inferLanguage).
  state/
    store.ts          Zustand; setProject builds/caches ScreenIndex.
                      switchStage = sugar for
                      switchScreen(firstScreenOf(id));
                      switchScreenRelative(±1) walks the flat ordered
                      list. "Switching to X..." status only fires across
                      stage boundaries.
    stageReducer.ts   pure tab reconciliation (reconcileScreenSwitch),
                      consumes resolved open so per-step overrides take
                      effect. Stage-reset variant collapses tabs to the
                      resolved open file when crossing into reset: true.
  hooks/              useUiScale (Ctrl+=/-/wheel, Ctrl+0),
                      useExplorerToggle (Ctrl+E), useStageShortcuts
                      (Space/PageDown/Ctrl+Space — walks every screen
                      across stage boundaries), useMouseHistoryNav
                      (XButton1/2 → goBack/goForward; capture-phase;
                      suppressed while video demo is open),
                      useRunShortcut (Ctrl+Enter / F5), useTabShortcuts
                      (Ctrl+W close active tab, Ctrl+Home re-apply
                      screen.open — id resolution via the symbol table
                      so it works even when the file is already active;
                      pendingNavigation bumps regardless),
                      useRenderedFile (useScreenIndex / useCurrentScreen
                      / useCurrentStage / useVisibleFiles /
                      useSymbolTable / useActiveRenderedFile).
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

// File-level visibility (must be before any code; can carry sibling focus=)
// @prezl file=[shell...]
// @prezl file=[shell...] focus=[shell]
```

Selectors accept screen ids, not just stage ids:

- `[shell]` — every screen of the shell stage
- `[shell.intro]` — exactly one screen
- `[shell.intro...preview.fetch]` — closed range, crosses stage boundaries
- `[shell...preview]` — bare ids in a range resolve to first/last
  screen of the stage on each side
- `[shell, preview.intro]` — explicit list, mix bare and dotted

Attribute semantics:

- `id=<name>` — optional identifier. Doubles as the mark for YAML
  `open.id` to target. If the directive also opens a region, the id
  anchors the first content line inside it.
- `show=[selector]` — region is **removed** (line numbers shift) on
  screens not in the selector.
- `focus` (bare flag) — whole-line decoration on every screen.
- `focus=[selector]` — highlight only on listed screens.
- `collapse` (bare flag) — fold a region, always collapsed by default.
- `collapse=[selector]` — fold only on listed screens.
- `label="..."` — label text for the collapsed fold's placeholder. Only
  valid when `collapse` is present.
- `file=[selector]` — file-level gate; whole file absent from the
  explorer on non-matching screens. Must appear before any code. May
  carry a sibling `focus(=[selector])?` to highlight the file's
  explorer entry on matching screens — the leaf row tints to
  `--color-focus` with a left stripe (mirrors `.code-line-focused`),
  and any *collapsed* folder ancestor that contains a focused
  descendant gets a quieter `text-focus/70` tint without auto-
  expanding. The folder tint drops as soon as it's expanded, since
  the focused leaves underneath then carry the cue themselves. Focus
  is a no-op when `file=` itself hides the file on the current screen
  (focus implies visible). No other attributes combine with `file=`.

The collapse fold's `start` is the first content line and `end` is
the last. The viewer renders this two ways:

- **No label** — the start line stays visible and an inline `⋯` is
  appended after its content (`type Foo = { ⋯`); body and end are
  hidden.
- **With label** — the entire `[start, end]` block is hidden and a
  single synthetic comment line stands in for it at the start line's
  indent (e.g. `  // user fields`). The fold-toggle chevron rides on
  the placeholder. Comment syntax is picked from the file's inferred
  language (`commentSyntaxFor` in `CodeView.tsx`); it's purely
  decorative — doesn't have to round-trip through `detectDirective`.

The parser captures the **opening `@prezl` directive line's** leading
whitespace into `FoldRange.indent` so the placeholder sits where the
author wrote the directive — not where the first content line happens
to be indented to. That way the collapsed line sits at the depth the
author chose for the marker, regardless of how the body inside is
indented.

Outer wins: if an outer `show` drops a region, nested `collapse`/`focus`
never fire.

## Code viewer

`CodeView.tsx` is a static, read-only HTML viewer — Shiki tokens plus
plain DOM for line numbers, fold widgets, focus highlights, and
click-to-jump symbol spans. Replaces a Monaco wrapper that brought
~2.5 MB of editor for features we'd turned off, plus flicker-prone
fold-model caching. Tokenization is async-but-cheap; the viewer shows
raw text in the meantime — never blank.

**Two fold-key shapes, on purpose.** `collapsedFolds` keys by
*rendered* line numbers (what `isLineHidden` operates on);
`manuallyExpandedRef` keys by *original-source* lines via
`RenderedFile.originalLineMap` (`manualKey`). A `show=` region above
a fold shifts its rendered range across steps; original-source
positions don't, so a presenter-opened fold stays recognised even
when its rendered range moves. Without this split, an expansion in
step 1 would re-collapse on the step that toggles a `show=` above it.
`manuallyExpandedRef` clears on file/stage change, so manual opens
persist within a `(file, stage)` and reset cleanly across boundaries.

**`flash` is a dual-purpose signal.** `scrollToLine(line, flash)` —
`flash: true` (symbol clicks) means transient fold reveal + visible
flash. `flash: false` (the `screen.open` path) means persistent reveal
(recorded in `manuallyExpandedRef`) + no flash. Otherwise every step
advance would flash distractingly.

**Capture-phase shortcuts.** Global shortcuts (zoom, Ctrl+E,
Ctrl+Enter / F5 / Ctrl+F5, Ctrl+T, Ctrl+W, Ctrl+Home, screen
navigation) register with `{ capture: true }` so any focused control
can't claim them first. The F5 / Ctrl+F5 capture binding also
suppresses the WebView's default page-refresh.

**Screen navigation:**

| | Next | Prev |
| --- | --- | --- |
| Bare | Space | Shift+Space |
| Clicker | PageDown | PageUp |
| Legacy | Ctrl+Space | Ctrl+Shift+Space |

`useStageShortcuts` skips when focus is on a real text-typing control
(contentEditable, `<input>`, `<textarea>`); buttons/selects fall
through.

**Video modal absorbs the clicker.** While open, `useStageShortcuts`
explicitly skips (`demoState.kind === 'video'` or `'picker'`) and the
modal handles: Space/PageDown play-pause until the clip ends (`stopAt`
or natural `ended`), then close — and advance the deck if
`demoState.trailing` (the trailing video IS the leaving act);
Escape/PageUp close without advancing. So PageDown drives playback
inside the video and screen nav outside; PageUp closes the video or
walks backward.

**Symbol decorations are inline.** `useSymbolTable` (`Map<id, {file,
line}>` of every anchor on the current screen) feeds a token-walking
pass that wraps word-boundary matches in `.prezl-symbol` spans with
`data-target-*` attrs; definition site skipped, click handler
delegates to `navigateToFileLine`.

**Debugging.** `useActiveRenderedFile` logs the parsed `RenderedFile`
to the console on every parse, keyed by screen id. For parser-only
questions, prefer adding a failing case to the relevant Vitest file
and running `pnpm test` (or `pnpm test:watch`) over ad-hoc debug
scripts:

- `src/project/stageList.test.ts` — screen index + selector grammar
- `src/project/directiveParser.test.ts` — directive parsing
- `src/project/visibleFiles.test.ts` — file-level gate filter
- `src/state/stageReducer.test.ts` — tab reconciliation

See `docs/internal/code-viewer.md` for the deep dive on tokenization,
folding mechanics, the full scroll-priority chain, fold auto-expansion
on jumps, and flash WAAPI details.

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
ids.

`Ctrl+T` lists *navigable* anchors only — see `useNavigableSymbols` in
`useRenderedFile.ts`. An id qualifies when its name appears at least
once as a word-boundary token in some visible file's rendered text
outside its own definition line. Pure section anchors (the kind you
add only so YAML `open.id` can scroll there) drop out of the picker
because they have nothing to click on in code. The unfiltered
`useSymbolTable` is still what powers click-to-jump and what
`@prezl open.id` resolves against, so the anchor still works as a
scroll target — it just stops being noise in the picker.

`Ctrl+T` opens the **Symbol Finder** modal: fuzzy search over the
current screen's symbol table, arrow keys cycle results, Enter jumps,
Esc closes.

**Watch for hook-ordering bugs in modal components.** The SymbolFinder
modal initially returned `null` when closed and then declared another
`useEffect` below that early return — React saw a different hook count
across renders and crashed the whole tree, blanking the UI. ALL hooks
must come before any early return.

## Markdown intros (`.prezl/` folder + MarkdownView)

`.md` files render as styled markdown via `MarkdownView` when opened.
Dispatch happens in `CodeView.tsx` — if `inferLanguage(activeFile) ===
'markdown'`, render `MarkdownView` instead of the line-numbered code
view. The component consumes the same `RenderedFile` everything else
does, so directive line stripping and `show=`/`file=` gating Just Work
in markdown. Region directives (`collapse=`, `focus=`) are parsed but
ignored — they don't make sense without line numbers.

Markdown rendering uses `marked` (GFM enabled — tables, task lists,
strikethrough, autolinks). Code fences upgrade to Shiki output in a
second async pass after the highlighter is ready; the base HTML shows
immediately so there's no blank moment. Styles in `globals.css` under
`.prezl-md`.

**`.prezl/` private folder.** The project root is the file root —
there's no `files/` wrapper. The Rust file walker (`commands.rs`)
walks the root directly and allow-lists exactly one dotfolder name
— `.prezl/` — so files at `.prezl/**` are loaded into `rawFiles`
like any other source but never appear in the explorer (filtered at
the `ExplorerTree.tsx` boundary, not in `computeFileVisibility`, so
the files still participate in symbol tables / parsing). The walker
also hides `prezl.yaml` / `prezl.yml` from the root listing — the
manifest is the project marker, not a presentable file. Tabs
already use `path.split('/').pop()` so `.prezl/intro.md` shows as
`intro.md` without any tab-specific change. Intended pattern:
`stage.open: .prezl/intro.md` opens the intro on stage entry; the
"presenter close survives step transition" rule means closing it
sticks for the rest of the stage. Videos and other presenter-private
binaries typically live under `.prezl/videos/`.

**Link shorthand in markdown.** `MarkdownView` decorates anchor
hrefs at layout time:

- `[label](path[#id][@line])` — uses `parseTargetShorthand` (now
  exported from `schema.ts`); resolves `#id` against the project-wide
  symbol table; click calls `navigateToFileLine`. Files in
  `visitedFilesInStage` get a `✓` tick + muted styling — same
  visited tracking the cover list uses.
- `[label](demo://<id>)` — looks up the demo in `demosById` (built
  by `buildDemoIndex` in `stageList.ts`, cached on the store at
  `setProject` time alongside `screenIndex`); click calls `runDemo`
  with the resolved demo. Demo `id:` is a project-wide identifier on
  `urlDemo` / `videoDemo` (first-wins on duplicates). Unresolved ids
  render muted with `⚠` — visible mistake without breaking the
  page. Renders with a `▶` play affordance, flipping to a muted
  `✓` once launched. Launch tracking lives on the store as
  `launchedDemosInOpen: Set<string>` (keyed by demo id), populated
  at every site that flips `demoState` into a "showing" form
  (`runDemo`'s `launching` transition plus the three autoLaunch
  entry points: initial in `setProject`, `autoLaunchStartFor` in
  `switchScreen`, trailing-end in `switchScreenRelative`). Reset
  policy mirrors `visitedFilesInOpen` exactly — cross-stage entry
  or open-frame reference change clears it; consecutive steps that
  inherit the stage's `open` preserve it.
- `https?://`, `mailto:`, `tel:`, `ftp:` — `tauri-plugin-shell`
  opens externally.
- `#anchor` — native browser scroll (marked auto-generates heading
  ids).

Decoration is a side-effect on the anchor element via dataset
attributes (`data-prezl-link-kind`, etc.), and a delegated click
handler at the container dispatches without re-parsing the href.
Same pattern as `.prezl-symbol` spans in `CodeView`.

## Demo fixture

`examples/demo/` — four-stage project with one stepped stage; use it
to verify parser/renderer changes. The `preview` stage is the
heaviest: a `.prezl/intro.md` README (markdown rendering + link
shorthand + a `demo://backoffice-walkthrough` link to the next
stage's demo), step→stage open inheritance, per-step `open` swapping
the file, an `autoLaunch: 'end'` trailing video, file-level focus
tinting, and a `demo: ~` reset of an inherited override. Switching
screens should re-apply folds and never flash. Per-stage walkthrough:
`examples/demo/README.md`.
