# Code viewer internals

`CodeView.tsx` is a static, read-only HTML viewer — no editor library.
Tokens come from Shiki (singleton in `shikiSetup.ts`); everything else
(line numbers, fold widgets, focus highlights, click-to-jump symbol
spans) is plain DOM.

## Why no Monaco

The previous Monaco wrapper was ~2.5 MB of editor for features we
explicitly turned off (IntelliSense, hover, cursor, etc.). Cold start
showed a black screen until the editor mounted; stage switches needed a
`visibility: hidden` flicker-prevention dance because Monaco's
FoldingController cached models we couldn't easily invalidate. Static
HTML rendering eliminates both — content is visible the moment the
parser produces a `RenderedFile`, and screen switches are a normal
React re-render.

## Tokenization

Async-but-cheap. First `getHighlighter()` resolves the Shiki bundle
(~150–250 KB; per-language grammars lazy-load on demand). Until tokens
arrive, the viewer renders the raw text without colours — readable and
never blank. After resolution, subsequent tokenizations are synchronous.

## Folding state

Local to CodeView. A `Set<string>` of fold keys (`${start}-${end}`) is
re-seeded from `RenderedFile.foldRanges` on every `(file, screen)`
change, so directive defaults reapply at every screen boundary. Manual
presenter *expansions* persist across step transitions within the same
`(file, stage)` via a separate `manuallyExpandedRef` set: the seeding
pass adds defaults but skips keys the presenter has already opened.
Crossing into a different stage (forward, back, dropdown, or
`reset: true`) or swapping files clears the override set so the new
context seeds cleanly.

The two key shapes diverge on purpose. `collapsedFolds` keys by
*rendered* line numbers (what the renderer/`isLineHidden` operate on),
but `manuallyExpandedRef` keys by *original-source* line numbers via
`RenderedFile.originalLineMap` (`manualKey` in CodeView.tsx). A `show=`
region inside or above a fold shifts the fold's rendered start/end
across steps; the original-source positions don't, so a presenter-
opened fold stays recognized even when its rendered range moves.
Without this split, expanding fold A in step 1 would re-collapse on the
step that toggles a `show=` region above it.

Auto-expansion inside `scrollToLine` is split by intent. When the
caller passes `flash: true` (symbol click — explicit user jump), the
containing-fold reveal is transient and the next screen re-collapses
per defaults. When the caller passes `flash: false` (the `screen.open`
path — the step's authored landing target), any containing folds it
opens get recorded in `manuallyExpandedRef`, so subsequent step
transitions within the same `(file, stage)` keep them open. The
`flash` boolean does double duty: line-flash gating *and* the
transient-vs-persistent expansion signal.

## Symbol decorations

Inline. `useSymbolTable` returns a `Map<id, {file, line}>` of every
anchor on the current screen. The renderer walks each line's Shiki
tokens and, for any token whose text contains a known id at a word
boundary, splits the token to wrap the match in a `.prezl-symbol` span
with `data-target-*` attrs. The definition site is skipped. A single
click handler at the container delegates jumps via
`navigateToFileLine`. The Ctrl+T picker uses `useNavigableSymbols`
instead — same shape, but pre-filtered to ids with at least one
non-definition word-boundary occurrence in some visible file's
rendered text. Pure section anchors (typically just `open.id` scroll
targets) get filtered out so the picker only lists ids the audience
could actually click on in the code.

## Scroll handling

A `useLayoutEffect` scrolls the target line into view before paint on
`(file, screen, pendingNavigation)` change. Priority:

1. `pendingScrollTop` (back/forward replay)
2. `pendingNavigation`
3. `screen.open.id`
4. `screen.open.line`
5. preserve current scrollTop when the file is unchanged from the
   previous screen
6. top of file

The `screen.open` is the resolved value (step override wins over stage
default), so per-step opens drive scroll. The "preserve when same
file" fallback is what keeps step advances through one file from
snapping back to the top when the new step has no scroll opinion of
its own.

Two extras layer onto every `scrollToLine` call:

- **Auto-expand containing folds.** Any fold whose range covers the
  target line (inclusive of `start`, since the start line is the
  fold's visible header — clicking a symbol on a `collapse`d type
  declaration should reveal the body, not just sit on the summary)
  gets its key removed from `collapsedFolds` before scrolling. In
  cross-file jumps the seeding effect's `setCollapsedFolds(initial)`
  runs first and collapses everything per directive defaults; our
  updater runs on top via `setCollapsedFolds(prev => prev -
  containing)`, so the order produces "defaults minus containing."
  When expansion happens we defer the actual scroll one frame
  (`requestAnimationFrame`) so React has committed the new collapsed
  state and the line is back in the DOM.
- **Highlight flash.** `flashLine(el)` runs `el.animate(...)` with a
  stable `Animation.id` so repeat jumps cancel any in-flight flash and
  restart cleanly. Imperative WAAPI (not a CSS class) so React's
  className diff can't strip it mid-animation. Only fires for explicit
  jumps — `scrollToLine` takes a `flash: boolean` and the
  `screen.open` path passes `false`, otherwise every step advance
  would flash distractingly. Colour reads `--color-app-accent` via
  `getComputedStyle` so the flash stays themed.

## Video modal mechanics

While the video demo is open, `useStageShortcuts` explicitly skips
(`demoState.kind === 'video'`), and the modal's own capture-phase
handler intercepts:

- `Space` / `PageDown` → play/pause; once the clip has hit its end
  (either a `stopAt` cue or the file's natural `ended` event), these
  close the modal so forward nav defaults to "I'm done, carry on."
  For a *trailing* video (one opened via `autoLaunch: 'end'`, flagged
  by `demoState.trailing`) this same press also advances the deck —
  the trailing video IS the leaving act, so it shouldn't take an
  extra Space.
- `Escape` / `PageUp` → close demo, never advance.
- The Restart chip (only shown at `stopAt`) takes an explicit click —
  replaying is the rare deliberate case, not what forward nav should
  do.

So with the same remote, PageDown drives playback inside the video
and drives screen navigation outside; PageUp closes the video or
walks backward a screen.

## Debugging the parser

`useActiveRenderedFile` logs the parsed `RenderedFile` (text,
foldRanges, focusRanges, marks, hiddenForStage, errors) to the
console on every parse, keyed by screen id. Compare against what the
viewer actually renders if behaviour looks wrong.

For parser-only questions, the Vitest suite covers the pure logic
directly:

- `src/project/stageList.test.ts` — screen index build + selector grammar
- `src/project/directiveParser.test.ts` — full directive parsing
- `src/project/visibleFiles.test.ts` — file-level gate filter
- `src/state/stageReducer.test.ts` — tab reconciliation

Add a failing case to the relevant `.test.ts` file and run
`pnpm test` (one-shot) or `pnpm test:watch` (TDD loop). Prefer this
over ad-hoc debug scripts.
