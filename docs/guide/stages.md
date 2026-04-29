# Stages

A Prezl presentation is a sequence of **stages**, declared in
`prezl.yaml` under `stages:`. Each stage represents a moment in the
story — typically a point where new code has appeared, been
highlighted, or a preview should fire.

Stages are the abstraction; **branches are just the way we visualise
them**. Each stage has a short `alias` (the canonical id) and may
optionally carry a `branch:` label (e.g. a git branch name) for
display in the dropdown and status bar.

## Declaring a stage

```yaml
stages:
  - alias: main
    branch: main
    title: Starting point
    open: src/main.ts
```

- **`alias`** *(required)* — short handle used inside
  [`@prezl` directives](./directives) (e.g. `[shell...]`). Must be
  unique within the project.
- **`branch`** *(optional)* — label only. Conventionally the git
  branch name where the code for this stage lives, but Prezl never
  touches git. Shown in the status bar and used as a dropdown fallback
  when no `title` is set.
- **`title`** *(optional)* — display label in the stage dropdown.
- **`open`** *(optional)* — what to show when this stage becomes
  active. Either a bare path string (shorthand for "open at line 1")
  or `{ file: …, line: 42 }` / `{ file: …, id: someMark }`. See
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
preview modal is open (so Space/Esc belong to playback there).

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
through with Space, and each screen can override the stage's `open` and
`preview` to swap files or change the Run target mid-build.

```yaml
- alias: preview
  open: { file: src/dashboard.ts, id: registerDashboard }
  preview:
    type: url
    src: https://example.com/demo
  steps:
    - intro                          # bare-string shorthand
    - alias: fetchImpl
      open: { file: src/api.ts, id: fetchDashboardData }
    - alias: chartHelpers
      open: src/dashboard.ts
```

Each step is either a bare alias string (no overrides) or the full
object form with `alias`, optional `title`, `open`, `preview`, and
`cover`.

**Inheritance differs by field.** `preview` and `cover` are
**sticky-forward**: a missing value falls through to the previous
step's resolved value, with the stage's defaults seeding step 1. Once
a step overrides one, subsequent empty steps stay there until the next
explicit override.

`open` does **not** sticky-forward. Step 1 seeds from `stage.open`
(entering the stage is the author's "land here" intent), but
subsequent omitted steps resolve to "no opinion" — the runtime keeps
whatever the presenter is currently looking at, so a manual close (or
any other editor change) survives the step transition. This makes
omitted-step `open` the right default for "I don't care what's on
screen here." If you want every step to actively clear the editor,
write `open: ~` on each step explicitly. A partial step `open` like
`{ id: foo }` (no `file`) still inherits its file from the most recent
authored open with one — useful when a stepped stage walks through
anchors in a single file without restating the path. `open: ~` resets
to `stage.open`.

Each screen has the id `<stageAlias>.<stepAlias>` — `preview.intro`,
`preview.fetchImpl`, etc. — and that's what directive selectors target.
A stage with no `steps:` has one implicit screen whose id is just the
bare alias.

## Screen-aware visibility

The directive grammar accepts both bare stage aliases and dotted screen
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

## Previews per stage (and per step)

Any stage may declare a `preview:` — a URL or a video — that the Run
button triggers. Steps can override the preview with sticky-forward
inheritance (a missing step `preview:` carries the previous step's
value forward, seeded by the stage default). See [Previews](./previews).

## Stage cover (presenter agenda)

A stage can declare a `cover:` list — files (and optional anchors) the
presenter wants to remember to discuss while in this stage. The list
is rendered as a small clickable section under the file tree; rows tick
once their file has been opened during the stage's tenure.

```yaml
- alias: preview
  cover:
    - src/dashboard.ts                       # bare path — "open at top"
    - src/api.ts#fetchDashboardData          # path#id — open at anchor
    - file: src/dashboard.ts                 # full object form
      id: renderCharts
      label: Chart helpers                   # optional row label
```

Each entry is either a bare path string, the `path#anchorId` shorthand
(opens the file at the matching `@prezl id=` anchor), or the object
form with `file` (required), optional `id` / `line` / `label`.

Steps inherit `cover` from the stage with sticky-forward, exactly like
`preview`. Override per step by setting your own `cover:`, or write
`cover: ~` to drop a step-level override and revert to the stage
default. Cover never propagates across stage boundaries — each stage
is its own agenda.

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
- alias: preview
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
name: Umbraco Dashboard Demo

stages:
  - alias: main
    branch: main
    title: Starting point
    # No `open:` — start with the file tree only (default empty pane).

  - alias: shell
    branch: feature/dashboard-shell
    title: Add dashboard shell
    open: { file: src/dashboard.ts, id: registerDashboard }

  - alias: preview
    branch: feature/dashboard-preview
    title: Preview dashboard
    open: { file: src/dashboard.ts, id: registerDashboard }
    preview:
      type: url
      src: https://example.com/demo/dashboard
      mode: external
    steps:
      - intro
      - alias: fetchImpl
        open: { file: src/api.ts, id: fetchDashboardData }
      - alias: chartHelpers
        open: { file: src/dashboard.ts, id: renderCharts }

  - alias: demo
    branch: feature/recorded-demo
    title: Recorded backoffice walkthrough
    open: src/api.ts
    preview:
      type: video
      src: ./videos/backoffice-demo.mp4
      startAt: 4.5
      stopAt: 32.0
      cues:
        - { time: 12.0 }
        - { time: 21.5 }
        - { time: 28.0 }
```
