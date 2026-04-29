# Stages

A Prezl presentation is a sequence of **stages**, declared in
`prezl.yaml` under `stages:`. Each stage represents a moment in the
story — typically a point where new code has appeared, been
highlighted, or a demo should fire.

Stages are the abstraction; **branches are just the way we visualise
them**. Each stage has a short `id` (the canonical handle) and may
optionally carry a `branch:` label (e.g. a git branch name) for
display in the dropdown and status bar.

## Declaring a stage

```yaml
stages:
  - id: main
    branch: main
    title: Starting point
    open: src/main.ts
```

- **`id`** *(required)* — short handle used inside
  [`@prezl` directives](./directives) (e.g. `[shell...]`). Must be
  unique within the project.
- **`branch`** *(optional)* — label only. Conventionally the git
  branch name where the code for this stage lives, but Prezl never
  touches git. Shown in the status bar and used as a dropdown fallback
  when no `title` is set.
- **`title`** *(optional)* — display label in the stage dropdown.
- **`open`** *(optional)* — what to show when this stage becomes
  active. Either a string shorthand (`path`, `path#id`, `path@line`,
  or `path#id@line` — suffixes optional, either order) or the object
  form `{ file?, line?, id? }`. See
  [Symbol navigation](./symbol-navigation) for `id:` targets.
  Omitting `open:` at the stage level is **sticky-forward**: the screen
  inherits whatever the presenter is already on, so a stage with no
  `open:` sitting after a stage that did declare one continues to show
  that file. With nothing prior to inherit, the editor pane is empty and
  only the file tree is visible — the default first-stage state. Set
  to YAML null (`open: ~`) to **actively clear** the editor
  mid-presentation, forcing the empty state even when a prior stage
  had a file open. Both empty states render a faded brand mark and
  the project name as a title-card placeholder. (Step-level `open:`
  works differently — see [Steps](#steps-within-a-stage) below.)

The forward/backward sequence (Space / PageDown) follows the order in
which stages — and steps inside them — appear in the manifest. To
reorder, move the block.

## Walking between screens

| Shortcut | Action |
| --- | --- |
| `Space` / `PageDown` | Next screen (next step within stage, or first step of next stage) |
| `Shift+Space` / `PageUp` | Previous screen |
| Stage dropdown (titlebar) | Jump to any stage (lands on its first step) |

Prezl's keyboard handlers fire in capture phase so any focused control
can't claim the keystroke first, and they're suppressed while the video
demo modal is open (so Space/Esc belong to playback there).

The dropdown intentionally lists stages only — steps are internal to a
stage, the same way builds are internal to a slide in Keynote. Jumping
to a stage from the dropdown always lands on its first step. A small
`n / N` indicator in the titlebar shows progress through a multi-step
stage; it's hidden for stages with no steps, so simple decks look
unchanged.

## Steps within a stage

A stage can optionally declare an ordered list of `steps:` — the
build-style sub-navigation that fires inside what the audience perceives
as a single slide. Each step is a **screen** the presenter advances
through with Space, and each screen can override the stage's `open`,
`demos`, and `cover` to swap files or change the Run target
mid-build.

```yaml
- id: preview
  open: src/dashboard.ts#registerDashboard
  demo:
    type: url
    src: https://example.com/demo
  steps:
    - intro                          # bare-string shorthand
    - id: fetchImpl
      open: src/api.ts#fetchDashboardData
    - id: chartHelpers
      open: src/dashboard.ts#renderCharts
```

Each step is either a bare id string (no overrides) or the full
object form with `id`, optional `title`, `open`, `demo` /
`demos`, and `cover`.

**Inheritance differs by field.**

- **`demos` and `cover`** resolve **stage→step only** — there's no
  step-to-step chain. An omitted step uses the *stage default*; a
  step's own value replaces it for that screen; `~` (YAML null)
  explicitly clears it for that screen. Adding a demo on step 2
  does **not** carry into step 3 — step 3 falls back to whatever the
  stage declared.
- **`open`** does *not* sticky-forward across omitted steps either,
  but for a different reason: the runtime treats an omitted `open` as
  "no opinion at this screen," preserving whatever the presenter is
  currently looking at — so a manual close (or any other editor
  change) survives the step transition. Step 1 seeds from
  `stage.open` (entering the stage is the author's "land here"
  intent); subsequent omitted steps resolve to no-opinion. If you
  want every step to actively clear the editor, write `open: ~` on
  each step explicitly. A partial step `open` like `{ id: foo }` (no
  `file`) still inherits its file from the most recent authored open
  with one — useful when a stepped stage walks through anchors in a
  single file without restating the path. `open: ~` resets to
  `stage.open`.

Each screen has the id `<stageId>.<stepId>` — `preview.intro`,
`preview.fetchImpl`, etc. — and that's what directive selectors target.
A stage with no `steps:` has one implicit screen whose id is just the
bare stage id.

## Screen-aware visibility

The directive grammar accepts both bare stage ids and dotted screen
ids inside its selector brackets:

- `[shell]` — every screen of the shell stage
- `[shell.intro]` — exactly one screen
- `[shell.intro...preview.fetch]` — closed range, crosses stages
- `[shell, preview.intro]` — explicit list, mix bare and dotted
- `[shell...]` — from shell's first screen onwards

Example: a file that only exists from `shell` onwards, with focus that
follows the build inside `preview`:

```ts
// @prezl file=[shell...]

import type { App } from './framework'
// @prezl show=[preview...]
import { fetchDashboardData } from './api'
// @prezl end

// @prezl focus=[shell]
export function registerDashboard(app: App) { … }
// @prezl end

// @prezl show=[preview...] focus=[preview.intro]
async function render(container) { … }
// @prezl end
```

See [Directives](./directives) for the full grammar.

## Demos per stage (and per step)

Any stage may declare one or more **demos** — URLs and videos that
the Run button triggers. The YAML accepts both `demo:` (single
object shorthand) and `demos:` (explicit list); the Run button
shows a picker when there's more than one. Steps can override the list
(stage→step only — no step-to-step chain), or write `~` to explicitly
clear for that step. See [Demos](./demos).

## Stage cover (presenter agenda)

A stage can declare a `cover:` list — files (and optional anchors) the
presenter wants to remember to discuss while in this stage. The list
is rendered as a small clickable section under the file tree; rows tick
once their file has been opened during the stage's tenure.

```yaml
- id: preview
  cover:
    - src/dashboard.ts                       # bare path — "open at top"
    - src/api.ts#fetchDashboardData          # path#id — open at anchor
    - src/api.ts@42                          # path@line — open at line
    - file: src/dashboard.ts                 # full object form
      id: renderCharts
      title: Chart helpers                   # optional row label
```

Each entry is either a string shorthand (same `path[#id][@line]`
grammar `open` accepts) or the object form with `file` (required),
optional `id` / `line` / `title`. A single-item agenda can drop the
list dash entirely — `cover: src/foo.ts#fetchData` is shorthand for a
one-element list, mirroring `demo:` vs `demos:`.

Steps inherit `cover` from the stage with the same stage→step-only
resolution as `demos`. Override per step by setting your own
`cover:`, or write `cover: ~` to clear it for that step. Cover never
propagates across stage boundaries — each stage is its own agenda.

**Visited tracking** is keyed by file: opening the file ticks every
cover row pointing at it (regardless of whether the presenter scrolled
to a specific anchor). Ticks clear on every cross-stage transition. If
a step within the stage authors a different cover list, ticks for any
file appearing in the new list clear too, so each step's framing
starts fresh.

## Decluttering on cross-stage entry

A stage with `reset: true` re-grounds the workspace when the presenter
crosses into it from another stage:

```yaml
- id: preview
  reset: true
  open: src/dashboard.ts
```

Tabs collapse to just the resolved `open` file, and any explorer
folders the presenter expanded beyond the project's baseline get re-
collapsed. Folders (and top-level groups) the presenter deliberately
collapsed stay collapsed — the reset reduces clutter, it doesn't undo
deliberate hides. The active file's containing chain is forced open
so its tab still points at visible content.

The reset only fires on cross-stage entry. Step transitions within the
same stage, and back-nav across the boundary, leave the workspace
alone — the reset is a deliberate "we're starting a new phase" act,
not something to re-trigger mid-build.

## Full example

```yaml
name: Dashboard Demo

stages:
  - id: main
    branch: main
    title: Starting point
    # No `open:` — start with the file tree only (default empty pane).

  - id: shell
    branch: feature/dashboard-shell
    title: Add dashboard shell
    open: src/dashboard.ts#registerDashboard

  - id: preview
    branch: feature/dashboard-preview
    title: Preview dashboard
    open: src/dashboard.ts#registerDashboard
    demo:
      type: url
      src: https://example.com/demo/dashboard
      mode: external
    steps:
      - intro
      - id: fetchImpl
        open: src/api.ts#fetchDashboardData
      - id: chartHelpers
        open: src/dashboard.ts#renderCharts

  - id: demo
    branch: feature/recorded-demo
    title: Recorded backoffice walkthrough
    open: src/api.ts@1
    demos:
      - title: Recorded walkthrough
        type: video
        src: ./videos/backoffice-demo.mp4
        startAt: 4.5
        stopAt: 32.0
        cues:
          - { time: 12.0 }
          - { time: 21.5 }
          - { time: 28.0 }
      - title: Live dashboard
        type: url
        src: https://example.com/demo/dashboard
```
