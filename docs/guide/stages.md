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
  Omitting `open:` is **sticky-forward**: the screen inherits whatever
  the presenter is already on, so a stage with no `open:` sitting after
  a stage that did declare one continues to show that file. With
  nothing prior to inherit, the editor pane is empty and only the file
  tree is visible — the default first-stage state. Set to YAML null
  (`open: ~`) to **actively clear** the editor mid-presentation,
  forcing the empty state even when a prior stage had a file open.
  Both empty states render a faded brand mark and the project name as
  a title-card placeholder.

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
object form with `alias`, optional `title`, `open`, and `preview`.
Step values inherit **sticky-forward**: missing `open` / `preview` falls
through to the previous step's resolved value, with the stage's
defaults seeding step 1. Once a step swaps files, subsequent empty
steps stay there until the next explicit override.

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
button triggers. Steps can override the preview the same way they
override `open`, with sticky-forward inheritance. See
[Previews](./previews).

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
