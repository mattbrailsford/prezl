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
  (stage/step keys like `open`, `preview`, `cover`, `reset`, `steps`,
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
- A stage with no `steps:` has one implicit screen, id = stage alias.
- A stage with `steps:` produces one screen per step, id = `<stageAlias>.<stepAlias>`.

Stages and steps collapse into one flat ordered list (`screenIndex.ordered`).
Space/PageDown walks this list end-to-end, including across stage
boundaries. The dropdown still lists stages only (steps are internal,
like slide builds in Keynote); selecting a stage jumps to its first
step. A step indicator (`n / N`) appears in the TopBar only for stages
with multiple screens — single-step stages look unchanged.

Step `previews` and `cover` resolve **stage→step only** — there's no
step-to-step chain. Each step independently uses the stage default
unless it declares its own:

- `undefined` (omitted) → use the stage's `previews` / `cover`
- explicit `null` (`~` in YAML) → explicitly empty (this step has none
  even if the stage does); resolves to `undefined` at the screen level
- value → use as-is

Reference identity is preserved across consecutive inherited steps —
`buildScreenIndex` hands the same stage list reference to each — which
is what the autoLaunch logic and visited-tracking key off. So an
inherited preview list doesn't re-fire `autoLaunch: 'start'` on every
step, and an inherited `cover` doesn't reset visited tracking. (There
used to be a sticky-forward chain with `~` as an escape hatch — "drop
step 2's trailing-video override before reaching step 3"; that was
removed in favour of "declare per step or use the stage default." If
you need a preview available across steps, set it on the stage.)

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

If the author wants every step to actively clear the editor, they have
to write `open: ~` on each step explicitly — there's no inherited-`null`
shortcut. In practice presenter state during a "supposed to be empty"
stage rarely diverges from the intent, so the no-opinion default is the
right tradeoff.

Branch reload (file contents) only happens when crossing a stage
boundary; within-stage step changes are pure parser re-runs, so they
feel snappier than stage switches.

## Previews (Run button)

A stage or step declares previews via one of two YAML keys:

- `preview:` — single object shorthand (one preview)
- `previews:` — explicit array (zero or more)

Both are accepted; using both on the same stage/step is a parse-time
error (`preventBothPreviewFields` superRefine). The loader's
`resolvePreviewField` normalises whichever the author wrote into a
single internal `Stage.previews` / `Step.previews` of type
`Preview[] | null | undefined`. The runtime exposes
`Screen.previews: Preview[] | undefined`. Two invariants on the
resolved list, enforced at parse time:

- ≤1 entry with `autoLaunch: 'start'`
- ≤1 entry with `autoLaunch: 'end'`

Each entry may carry an optional `title:` string. The picker uses it as
the row label (with the URL or video basename as fallback), so two
entries that share a `src` can still be distinguished at the moment of
selection.

Run button behaviour (also wired into Ctrl+Enter):

- Empty list → button disabled, status toast "No preview configured".
- Exactly one → launch directly (URL preview opens externally; video
  preview opens the modal).
- More than one → set `previewState` to `{ kind: 'picker', previews }`,
  which mounts `PreviewPicker`. The picker is a SymbolFinder-style
  modal: arrow keys cycle, Enter selects, Esc / click-outside closes.
  The selected preview routes through `runPreview(chosen)`, which
  bypasses the picker check and goes straight to launching.

Only one preview is ever active at a time. The store's `runPreview`
guards against re-entry while a modal is up. Opening another preview
via picker selection only succeeds because the picker is itself a
non-launched state — selection transitions `picker` → `launching` →
`video` / closed.

`autoLaunch` firing rules use the (single-by-invariant) entry of each
mode, scanned per screen via `findAutoLaunchVideo(screen, mode)`:

- **start**: fires on cross-screen entry when the target's autoStart
  entry differs by reference from the previous screen's autoStart entry
  (or the previous screen had none) AND we're moving forward. Same
  entry across screens means "still in scope", so a stage-level
  autoStart preview doesn't relaunch on each step inside the stage.
- **end**: fires on forward-advance out of a screen when the current
  screen has an autoEnd entry whose reference differs from the next
  screen's autoEnd (or the next screen has none) AND
  `lastEndAutoLaunchedScreenId` doesn't match — the latter prevents
  the immediate "advance after watching" press from re-firing the
  trailing video. Deck-advance on close is gated on the modal having
  been opened via autoLaunch=end (`previewState.trailing === true`); a
  manual Run-launch of a preview that happens to have `autoLaunch:
  'end'` does NOT advance the deck on close.

The previewState `picker` variant absorbs Space/PageDown/PageUp the
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

A stage can declare a `cover:` array of files (and optional anchors) the
presenter wants to remember to discuss during that stage. Surfaced as a
small clickable list under the file tree (`StageCoverList`); items tick
once their file has been opened during the current stage's tenure.

Authoring shorthand uses the same `path[#id][@line]` mini-grammar that
`open` accepts (parsed by `parseTargetShorthand` in `schema.ts`). Both
suffixes are optional and either order works:

- `src/api.ts` → bare path
- `src/api.ts#fetchData` → file + symbol id
- `src/api.ts@42` → file + line
- `src/api.ts#fetchData@42` → all three

Suffixes peel from the rightmost separator and bail out cleanly when
the result wouldn't make sense (npm-scoped `@types/foo.ts` keeps the
`@`; `@head` keeps the literal tag because it isn't all digits; `@0`
isn't a valid line). Object form (`{ file, id?, line?, label? }`)
remains for cases the shorthand can't express — most notably a custom
row `label` in cover, or a partial `{ id }` in `open` that inherits
the file from the previous resolved open.

Steps may override the stage cover list with a step-level `cover:` —
same stage→step resolution as `previews` (omit → stage default, `~` →
explicitly empty, value → use it; no step-to-step chain). `open`
shares the tri-state shape but its omitted-step semantics are
different — see "The screen model". Cover does **not** propagate
across stage boundaries; each stage is its own agenda.

Visited tracking lives in `visitedFilesInStage: Set<string>` on the
store. Cleared on every cross-stage entry (forward, back, dropdown);
added to whenever `activeFile` changes (via `switchScreen`,
`openFile`, `setActiveFile`, `navigateToFileLine`, and the back/forward
`applyHistoryLocation` path). The list is by file, so opening the
target file ticks every cover item pointing at it — there's no
per-anchor visit detection. Click routes through
`navigateToFileLine` when the cover item resolves an `id` against the
current symbol table, otherwise falls back to `openFile`.

When stepping within a stage, a step transition whose cover *reference*
differs from the previous step's clears any visited entries that appear
in the new cover, so files listed under the new step's framing are
prompted to be re-visited. Visited entries that aren't in the new
cover stay ticked. Stage→step resolution preserves cover identity
across steps that don't override (consecutive inheriting steps all
resolve to the same stage list reference), so the common "every step
shares the stage's cover" case never triggers a reset.

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
    ExplorerTree.tsx    tree from useVisibleFiles(); header has Open
                        Folder + Collapse-All-Folders (preserves group-
                        header state) + Hide-Explorer buttons.
    CodeView.tsx        static read-only viewer — Shiki tokens, plain DOM
                        for line numbers / fold widgets / decorations.
                        Replaced Monaco; see "Code viewer" below.
  project/
    schema.ts           Zod validation for prezl.yaml (or prezl.yml — the
                        Rust loader tries .yaml first, falls back to .yml).
                        open: accepts a bare path string (shorthand for
                        { file }, no implicit line — CodeView preserves the
                        prior scrollTop if the file is unchanged across the
                        screen switch, else starts at the top, leaving
                        default-collapsed folds collapsed), the object
                        form (where `file` is optional — a partial
                        `{ id }` or `{ line }` inherits the file from
                        the previous resolved open via the buildScreenIndex
                        merge; the schema rejects an empty `{}`), or
                        explicit `null`
                        (`~` in YAML) meaning "actively clear — no file
                        open." Omitting `open:` on a step (other than
                        step 1, which seeds from `stage.open`) resolves
                        to `undefined` — the reducer's prior-active-file
                        rule keeps the runtime state, so a presenter close
                        survives across the transition without being
                        force-reopened. With nothing prior the pane stays
                        empty (no auto-fallback to the first explorer
                        file — that fallback was deliberately removed so
                        the default first-stage UX is "just the file
                        tree"). Empty pane renders EmptyEditorPane
                        (faded brand mark + project name) and EditorTabs
                        hides itself (kept only when the explorer is also
                        collapsed, so the expand-explorer button stays
                        reachable). Step entries accept a bare alias
                        string (shorthand for { alias }) or the object
                        form. Stages may set `reset: true` — see "Stage
                        reset" below.
    loader.ts           orchestrates pickProjectFolder / load_project /
                        list_project_files / read_project_file. The
                        backend's read_project_file returns Option<String>:
                        non-UTF-8 (binary) files come back as null and are
                        collected into LoadedProject.binaryFiles instead
                        of rawFiles, so the explorer still surfaces them.
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
                        effect. Also exposes a stage-reset variant that
                        collapses tabs to the resolved open file when
                        crossing into a `reset: true` stage.
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

// File-level visibility (must be before any code; can carry sibling focus=)
// @prezl file=[shell...]
// @prezl file=[shell...] focus=[shell]
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
every `(file, screen)` change, so directive defaults reapply at every
screen boundary. Manual presenter *expansions* persist across step
transitions within the same `(file, stage)` via a separate
`manuallyExpandedRef` set: the seeding pass adds defaults but skips
keys the presenter has already opened. Crossing into a different
stage (forward, back, dropdown, or `reset: true`) or swapping files
clears the override set so the new context seeds cleanly.

The two key shapes diverge on purpose. `collapsedFolds` keys by
*rendered* line numbers (what the renderer/`isLineHidden` operate on),
but `manuallyExpandedRef` keys by *original-source* line numbers via
`RenderedFile.originalLineMap` (`manualKey` in CodeView.tsx). A `show=`
region inside or above a fold shifts the fold's rendered start/end
across steps; the original-source positions don't, so a presenter-
opened fold stays recognized even when its rendered range moves.
Without this split, expanding fold A in step 1 would re-collapse on
the step that toggles a `show=` region above it.

Auto-expansion inside `scrollToLine` is split by intent. When the
caller passes `flash: true` (symbol click — explicit user jump), the
containing-fold reveal is transient and the next screen re-collapses
per defaults. When the caller passes `flash: false` (the `screen.open`
path — the step's authored landing target), any containing folds it
opens get recorded in `manuallyExpandedRef`, so subsequent step
transitions within the same `(file, stage)` keep them open. The
`flash` boolean does double duty: line-flash gating *and* the
transient-vs-persistent expansion signal.

**Symbol decorations are inline.** `useSymbolTable` returns a `Map<id,
{file, line}>` of every anchor on the current screen. The renderer
walks each line's Shiki tokens and, for any token whose text contains
a known id at a word boundary, splits the token to wrap the match in
a `.prezl-symbol` span with `data-target-*` attrs. The definition site
is skipped. A single click handler at the container delegates jumps
via `navigateToFileLine`. The Ctrl+T picker uses `useNavigableSymbols`
instead — same shape, but pre-filtered to ids with at least one
non-definition word-boundary occurrence in some visible file's
rendered text. Pure section anchors (typically just `open.id` scroll
targets) get filtered out so the picker only lists ids the audience
could actually click on in the code.

**Scroll handling.** A `useLayoutEffect` scrolls the target line into
view before paint on `(file, screen, pendingNavigation)` change.
Priority: `pendingScrollTop` (back/forward replay) > `pendingNavigation`
> `screen.open.id` > `screen.open.line` > preserve current scrollTop
when the file is unchanged from the previous screen > top of file. The
`screen.open` is the resolved value (step override wins over stage
default), so per-step opens drive scroll. The "preserve when same file"
fallback is what keeps step advances through one file from snapping
back to the top when the new step has no scroll opinion of its own.

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

- `Space` / `PageDown` → play/pause; once the clip has hit its end
  (either a `stopAt` cue or the file's natural `ended` event), these
  close the modal so forward nav defaults to "I'm done, carry on." For
  a *trailing* video (one opened via `autoLaunch: 'end'`, flagged by
  `previewState.trailing`) this same press also advances the deck —
  the trailing video IS the leaving act, so it shouldn't take an
  extra Space.
- `Escape` / `PageUp` → close preview, never advance.
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

## Demo fixture

`examples/demo/` — the four-stage project with one stepped stage. Use
it to verify behaviour after changes:

- `main`: only `main.ts` + `framework.ts` in the explorer; no `open:`
  declared, so the default "file tree only" state kicks in — empty
  editor pane (faded brand mark + project name) and hidden tab strip.
- `shell`: `dashboard.ts` appears; `registerDashboard` is the focus
  highlight. The file's own `file=[shell...] focus=[shell]` directive
  also tints the explorer leaf (and its `src/` folder) on this stage —
  exercises the file-level focus path.
- `preview` (3 steps — `intro` / `fetchImpl` / `chartHelpers`):
  - `preview.intro` — `dashboard.ts` open at `registerDashboard`,
    focus on `render()`. `Chart rendering helpers` collapsed at the
    bottom.
  - `preview.fetchImpl` — file swaps to `api.ts` via per-step `open`,
    focus on `fetchDashboardData`; `api.ts`'s own
    `file=[preview...] focus=[preview.fetchImpl]` also tints the
    explorer leaf for this one screen. Carries a step-level
    `autoLaunch: 'end'` video preview — forward-advancing from this
    screen plays the wrap-up clip first and then advances to
    `chartHelpers` on the carry-on close (atEnd Space).
  - `preview.chartHelpers` — file back to `dashboard.ts` via per-step
    `open`, scrolls to `renderCharts`. The `Chart rendering helpers`
    fold expands and is focus-highlighted; an inner `show=
    [preview.chartHelpers]` comment block becomes visible. Uses
    `preview: ~` to drop `fetchImpl`'s trailing-video override and
    fall back to the stage default (which is none here) — exercises
    the reset escape hatch.
- `demo`: everything visible, no focus (preview's focus selectors
  don't match this stage's screen).

Switching screens should re-apply folds and never show a flash.
