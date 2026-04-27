# `prezl.yaml` schema

Complete reference for the manifest file. See [Project
structure](../guide/project-structure) for a higher-level overview.

## Top-level keys

```yaml
name: My Project            # required — shown in the Prezl titlebar

projects:                   # optional — see Multi-project layout
  - { name: …, path: …, icon: …, color: … }

stages:                     # required — at least one
  - { … }
```

### `name` (required, string)

Displayed in the titlebar.

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
    file: src/dashboard.ts   #   required if `open:` is present
    line: 1                  #   scroll target; line OR id, not both
    id: registerDashboard    #   resolves to a `@prezl id=<name>` anchor
  steps: [ … ]               # optional — see Steps below
  symbols: {}                # reserved, not currently consumed
  preview:                   # optional — see Previews guide
    type: url | video
    …
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
      title: Chart helpers           # optional — currently unused in UI
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

## Notes

- YAML anchors / references are supported by the `yaml` parser Prezl
  uses, so you can DRY up repeated preview configs if you want.
- Trailing whitespace / alternate comment styles in YAML are fine; the
  parser is permissive.
- Changes to `prezl.yaml` require closing and reopening the project to
  take effect — there's no hot-reload on the manifest.
