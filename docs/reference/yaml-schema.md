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
  autoLaunch: true            # optional — open the modal automatically when
                              #   the presenter first lands on this screen
  cues:                       # optional — auto-pause timestamps
    - { time: 12.0, label: "Optional label for future use" }
```

Cues pause playback with a subtle Play chip; Space / PageDown /
chip-click resumes. Each cue fires once per session.

`autoLaunch: true` is the "lead with a video" pattern: the modal opens
the moment the presenter advances onto a screen carrying this preview,
without needing to click *Run* first. Sticky-inherited subsequent
steps don't re-fire — only an explicitly redeclared preview on a later
screen does. Going backward through the deck never re-fires either.

## Notes

- YAML anchors / references are supported by the `yaml` parser Prezl
  uses, so you can DRY up repeated preview configs if you want.
- Trailing whitespace / alternate comment styles in YAML are fine; the
  parser is permissive.
- Changes to `prezl.yaml` require closing and reopening the project to
  take effect — there's no hot-reload on the manifest.
