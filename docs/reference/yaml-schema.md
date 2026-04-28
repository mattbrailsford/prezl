# `prezl.yaml` schema

Complete reference for the manifest file. See [Project
structure](../guide/project-structure) for a higher-level overview.

## Top-level keys

```yaml
name: My Project            # required — shown in the Prezl titlebar
logo: assets/logo.svg       # optional — replaces the pretzel mark top-left

projects:                   # optional — see Multi-project layout
  - { name: …, path: …, icon: …, color: … }

stages:                     # required — at least one
  - { … }
```

### `name` (required, string)

Displayed in the titlebar.

### `logo` (optional, string)

Path to an image (SVG, PNG, JPEG, WebP — anything an `<img>` tag can
render) used in place of the Prezl pretzel mark in the top-left of the
editor. Resolved relative to the project root, so the file doesn't have
to live under `files/` — `logo: brand.svg` next to `prezl.yaml` is the
typical layout. Absolute paths and `https://` URLs are also accepted.
The tinted accent square is dropped when a custom logo is set so the
mark renders on its own.

### `projects` (optional, array)

Declares a multi-project layout. See the
[multi-project guide](../guide/multi-project). Each entry:

```yaml
- name: Backend              # required
  path: src/Backend          # required — path under files/
  icon: dotnet               # optional — glyph + color hint
  color: violet              # optional — overrides icon's default color
```

### `stages` (required, array)

At least one entry. Each entry is one stage of the presentation —
typically modelled as one git branch, but the stage is the abstraction
and the branch name is just the human-readable label that travels with
it. Stage order follows the order entries appear in the list — the first
entry is the starting stage, and screen-range directives like
`[shell...demo]` resolve against this order.

```yaml
- alias: shell               # required — canonical stage id, referenced
                             #            by directives like [shell...]
  branch: feature/dashboard  # optional — label only (e.g. git branch name)
  title: Add dashboard       # optional — dropdown label
  open:                      # optional — initial scroll target
    file: src/dashboard.ts   #   optional inside the object form (see below)
    line: 1                  #   scroll target; line OR id, not both
    id: registerDashboard    #   resolves to a `@prezl id=<name>` anchor
  steps: [ … ]               # optional — see Steps below
  symbols: {}                # reserved, not currently consumed
  preview:                   # optional — see Previews guide
    type: url | video
    …
  reset: true                # optional — declutter on cross-stage entry
```

The dropdown label cascades `title` → `branch` → `alias`, so a stage
with just an alias still shows up sensibly.

#### `open:` shorthand

When you only need "open this file at line 1," pass the path as a string:

```yaml
open: src/dashboard.ts       # equivalent to { file: src/dashboard.ts, line: 1 }
```

The full object form is only needed when you want to jump to a specific
`line:` or symbol `id:`.

#### Partial `open:` — inherit the file from the previous screen

Inside the object form `file` is optional. A step staying on the same
file as its predecessor can jump to a new anchor with just an `id` (or
`line`):

```yaml
- alias: preview
  open: src/dashboard.ts            # step 1: open the file
  steps:
    - alias: registerDashboard
    - alias: renderCharts
      open: { id: renderCharts }    # same file as before, jump to id
    - alias: fetchData
      open: { line: 42 }            # still same file, jump to line 42
```

The resolver fills in `file` from the previous resolved `open` so each
step's resolved value is fully self-describing. Subsequent steps that
omit `open:` continue sticky-forward inheritance from the merged value.

The empty object `{}` is rejected — at least one of `file`, `line`, or
`id` must be present.

#### Empty pane and `open: ~`

Omitting `open:` is **sticky-forward**: the screen inherits whatever
the presenter is already on. With nothing to inherit (e.g. the first
stage of the deck), the editor pane is empty and only the file tree
is visible — the default opening state. The tab strip hides itself
(unless the explorer is also collapsed, in which case the strip stays
so its expand-explorer button remains reachable). The empty pane
renders a faded brand mark with the project name as a title card.

```yaml
- alias: intro
  title: Project structure
  # No `open:` — file tree only, empty editor pane.
```

Setting `open: ~` (YAML null) is a stronger statement: **actively
clear** the open file, even when a prior stage / step had one set.
Useful for a mid-deck "summary" pause where the presenter wants the
audience back on the project structure:

```yaml
- alias: pause
  open: ~                    # explicit "no file" — overrides inheritance
```

Stepped stages propagate `open` (file or null) through every step that
doesn't override it. A later step can introduce a file with its own
`open:` and subsequent steps inherit that, just like any other override.

#### Stage `steps:` — sub-navigation within a stage

Optional ordered list of intra-stage screens — the build-style reveals
that fire as the presenter advances within a single "slide." Steps don't
appear in the stage dropdown; <kbd>Space</kbd> / <kbd>PageDown</kbd>
walks them linearly and then carries forward into the next stage's first
step.

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
      open: src/dashboard.ts         # `open:` shorthand also works here
      title: Chart helpers           # optional — shown next to the step counter in the TopBar
```

Each step entry is either:

- a **bare string** — shorthand for `{ alias: <string> }`, no overrides
- the **object form** with `alias` (required), `title?`, `open?`, `preview?`

Each screen's id is `<stageAlias>.<stepAlias>`, e.g. `preview.intro`,
`preview.fetchImpl`. A stage with no `steps:` has one implicit screen
whose id is just the bare alias (e.g. `shell`).

**Inheritance.** Step `open` and `preview` fall through with sticky
carry-forward: missing values inherit the **previous step's resolved
value**, with the stage's defaults seeding step 1. Once a step changes
the file or preview, subsequent empty steps stay there until the next
explicit override — matching how a presenter actually moves rather than
snapping back to defaults on every empty step.

**Reset escape hatch.** Set `open: ~` or `preview: ~` (YAML null) on a
step to drop the inherited step value and revert to the **stage's
default**. Useful when one step introduces an override (a different
file, or a trailing-video preview) and a later step in the same stage
should fall back to the stage's plain preview rather than carry that
override forward. Subsequent empty steps then inherit the reset value
(i.e., the stage default) — sticky-forward continues from the reset
point, not from the prior override.

**Aliases must be unique within a stage.** The schema rejects duplicates.

#### Stage `preview:` — URL

```yaml
preview:
  type: url
  src: https://example.com/demo
  mode: external              # optional — default: external
```

`src` must be `http://` or `https://`. Only `external` mode is supported
today (opens in the OS default browser).

#### Stage `preview:` — video

```yaml
preview:
  type: video
  src: ./videos/demo.mp4      # path relative to project root, or absolute http(s)
  startAt: 4.5                # optional — seconds
  stopAt: 32.0                # optional — pauses playback, shows Restart chip
  autoLaunch: start           # optional — 'start' (or true), or 'end'
  cues:                       # optional — auto-pause timestamps
    - { time: 12.0, label: "Optional label for future use" }
```

Cues pause playback with a subtle Play chip; Space / PageDown /
chip-click resumes. Each cue fires once per session.

`autoLaunch` opens the modal automatically without a *Run* click.
Each mode fires once per *scope* — the run of screens sharing the
same preview, formed when steps inherit a stage's preview or carry
forward a step-level override. Two modes:

- **`start`** (or shorthand `true`) — the "lead with a video"
  pattern: the modal opens on the first screen of the scope (the
  screen where the preview newly appears).
- **`end`** — the "trail with a video" pattern: the modal opens on
  the last screen of the scope, when the presenter forward-advances
  out of it. The screen advance pauses, the video plays, and a
  carry-on close (atEnd Space, or natural video end) advances the
  deck in the same press.

An explicitly redeclared preview on a later step starts a new scope
with its own start/end fires. Going backward never re-fires, and
once an `end` video has fired for its scope it won't replay in the
same session.

#### Stage `reset:` — declutter on cross-stage entry

```yaml
- alias: preview
  reset: true
```

When `reset: true`, entering this stage *from another stage* clears
workspace clutter that built up earlier in the deck:

- Open tabs collapse to just the resolved `open` file.
- The explorer is reset **monotonically toward less clutter** —
  folders the presenter expanded beyond the project's baseline are
  re-collapsed, but folders (and top-level groups) the presenter
  deliberately collapsed stay collapsed. The active file's containing
  chain is the one forced-open exception, since the tab would
  otherwise point at hidden content.

Step transitions within the stage and back-nav across the stage
boundary deliberately don't trigger the reset — it's a re-grounding
act for new phases of the talk, not something to fire mid-build or
when stepping back.

#### Stage `cover:` — presenter agenda

A list of files (and optional anchors) the presenter wants to remember
to discuss while in this stage. Surfaced as a small clickable section
under the file tree; rows tick once their file has been opened during
the current stage's tenure.

```yaml
- alias: preview
  cover:
    - src/dashboard.ts                         # bare path
    - src/api.ts#fetchDashboardData            # path#anchorId shorthand
    - file: src/dashboard.ts                   # full object form
      id: renderCharts
      label: Chart helpers                     # optional — overrides the row's basename
```

Each item is either:

- a **bare path string** — opens the file at the top
- a **`path#id` string** — opens the file and scrolls to the
  `@prezl id=<name>` anchor
- the **object form** with `file` (required), `id?`, `line?`, `label?`

`label` overrides the row's display text (otherwise the file's
basename is shown). `id` resolves through the same project-wide symbol
table the click-to-jump path uses.

**Inheritance.** Steps inherit `cover` from the stage and from
preceding steps with sticky carry-forward, exactly like `open` and
`preview`. A step can override the list with its own `cover:`, or
reset to the stage default with `cover: ~`. Cover does not propagate
across stage boundaries — each stage is its own agenda.

**Visited tracking.** "Visited" is keyed by file path and cleared on
every cross-stage transition (forward, back, or via the dropdown).
Opening the file ticks every cover row pointing at it, regardless of
whether the presenter actually scrolled to a specific anchor — the
goal is "did I cover this file" rather than per-anchor accounting.

When stepping within a stage, a step that authors its own `cover:`
(different reference from the previous step's resolved cover) clears
the tick on any file appearing in the new cover, so each step's
agenda starts fresh. Files visited under the previous step's framing
that aren't in the new cover stay ticked. Steps that inherit the
stage cover by sticky-forward (no override) don't trigger a reset.

## Notes

- YAML anchors / references are supported by the `yaml` parser Prezl
  uses, so you can DRY up repeated preview configs if you want.
- Trailing whitespace / alternate comment styles in YAML are fine; the
  parser is permissive.
- Changes to `prezl.yaml` require closing and reopening the project to
  take effect — there's no hot-reload on the manifest.
