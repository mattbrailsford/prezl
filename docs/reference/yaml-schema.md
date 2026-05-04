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
editor. Resolved relative to the project root — `logo: brand.svg` next
to `prezl.yaml` is the typical layout. Absolute paths and `https://`
URLs are also accepted. The tinted accent square is dropped when a
custom logo is set so the mark renders on its own.

### `projects` (optional, array)

Declares a multi-project layout. See the
[multi-project guide](../guide/multi-project). Each entry:

```yaml
- name: Backend              # required
  path: src/Backend          # required — path relative to project root
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
- id: shell               # required — canonical stage id, referenced
                             #            by directives like [shell...]
  branch: feature/dashboard  # optional — label only (e.g. git branch name)
  title: Add dashboard       # optional — dropdown label
  open: src/dashboard.ts     # optional — string shorthand or object (see below)
  steps: [ … ]               # optional — see Steps below
  symbols: {}                # reserved, not currently consumed
  demo:                   # optional — single demo (object shorthand)
    type: url | video
    …
  demos:                  # optional — list of demos (alternative form)
    - …
  cover: [ … ]               # optional — presenter agenda
  reset: true                # optional — declutter on cross-stage entry
```

The dropdown label cascades `title` → `branch` → `id`, so a stage
with just an id still shows up sensibly.

`demo:` and `demos:` are mutually exclusive — picking one or the
other is a parse error. Use whichever reads better; the runtime
normalises both into the same internal list.

#### `open:` shorthand

The string form accepts a small grammar of optional suffixes. All four
are valid:

```yaml
open: src/dashboard.ts                       # bare path (no specific line)
open: src/dashboard.ts#registerDashboard     # path#id — jump to symbol anchor
open: src/dashboard.ts@42                    # path@line — jump to line
open: src/dashboard.ts#registerDashboard@42  # all three — id wins for scroll
```

Suffixes peel from the rightmost separator and bail out cleanly when
the result wouldn't make sense (npm-scoped paths like
`node_modules/@types/foo.ts` keep the `@` intact; `@head` is left as
part of the path because it isn't all digits; `@0` likewise — line
must be a positive integer).

The full object form `{ file?, line?, id? }` is for cases the shorthand
can't express — most often a partial `{ id: foo }` step that inherits
its file from the previous resolved open.

A bare path string with no suffixes opens the file with no specific
scroll target — the viewer keeps the previous scrollTop if the file is
unchanged across the screen switch, otherwise starts at the top with
default-collapsed folds collapsed. Setting `@1` explicitly routes
through `scrollToLine` instead, which auto-expands any fold containing
the target line — useful only when the author wants that expansion to
fire.

#### Partial `open:` — inherit the file from the most recent authored open

Inside the object form `file` is optional. A step staying on the same
file as its predecessor can jump to a new anchor with just an `id` (or
`line`):

```yaml
- id: preview
  open: src/dashboard.ts            # stage default seeds step 1
  steps:
    - id: registerDashboard
    - id: renderCharts
      open: { id: renderCharts }    # same file as before, jump to id
    - id: scrollOnly             # no `open:` — see "Inheritance" below
    - id: fetchData
      open: { line: 42 }            # file still resolves to dashboard.ts
```

The resolver fills in `file` from the **most recent authored open
that had one** (tracked separately from each step's resolved
`screen.open`), so an authored partial after an omitted step still
points at the right file.

The empty object `{}` is rejected — at least one of `file`, `line`, or
`id` must be present.

#### Empty pane and `open: ~`

Omitting `open:` at the **stage** level lets the presenter's current
state carry forward — there's no force-reopen on stage entry beyond
what the author asked for. With nothing to inherit (e.g. the first
stage of the deck), the editor pane is empty and only the file tree
is visible — the default opening state. The tab strip hides itself
(unless the explorer is also collapsed, in which case the strip stays
so its expand-explorer button remains reachable). The empty pane
renders a faded brand mark with the project name as a title card.

```yaml
- id: intro
  title: Project structure
  # No `open:` — file tree only, empty editor pane.
```

Setting `open: ~` (YAML null) is a stronger statement: **actively
clear** the open file, even when a prior stage / step had one set.
Useful for a mid-deck "summary" pause where the presenter wants the
audience back on the project structure:

```yaml
- id: pause
  open: ~                    # explicit "no file" — overrides inheritance
```

Inside a stepped stage, only step 1 seeds from `stage.open` — later
steps that omit `open:` resolve to "no opinion" and the runtime keeps
whatever the presenter is currently looking at. See
[`open` inside steps](#stage-steps--sub-navigation-within-a-stage)
below for the full set of rules.

#### Stage `steps:` — sub-navigation within a stage

Optional ordered list of intra-stage screens — the build-style reveals
that fire as the presenter advances within a single "slide." Steps don't
appear in the stage dropdown; <kbd>Space</kbd> / <kbd>PageDown</kbd>
walks them linearly and then carries forward into the next stage's first
step.

```yaml
- id: preview
  open: src/dashboard.ts#registerDashboard
  demo:
    type: url
    src: https://example.com/demo
  steps:
    - intro                                    # bare-string shorthand
    - id: fetchImpl
      open: src/api.ts#fetchDashboardData
    - id: chartHelpers
      open: src/dashboard.ts#renderCharts
      title: Chart helpers                     # optional — shown next to the step counter in the TopBar
```

Each step entry is either:

- a **bare string** — shorthand for `{ id: <string> }`, no overrides
- the **object form** with `id` (required), `title?`, `open?`,
  `demo?` / `demos?`, `cover?`

Each screen's id is `<stageId>.<stepId>`, e.g. `preview.intro`,
`preview.fetchImpl`. A stage with no `steps:` has one implicit screen
whose id is just the bare id (e.g. `shell`).

**Inheritance differs by field.**

- **`demos` and `cover`** resolve **stage→step only** — there's no
  step-to-step chain. An omitted step uses the *stage default*; a
  step's own value replaces it for that screen; `~` (YAML null)
  explicitly clears it for that screen. Adding a value on step 2
  does **not** carry into step 3 — step 3 falls back to whatever the
  stage declared.
- **`open`** does *not* sticky-forward either, but the runtime treats
  an omitted `open` as "no opinion at this screen," preserving
  whatever the presenter is currently looking at. Step 1 seeds from
  `stage.open` (entering the stage IS the author's "land here"
  intent), but subsequent omitted steps resolve to *no opinion* — a
  manual close (or any other editor change) survives the step
  transition. Authoring "every step actively clears the editor"
  requires writing `open: ~` on each step explicitly. A partial step
  `open` (`{ id }` or `{ line }` with no `file`) still inherits its
  file from the most recent authored open with one — see
  [Partial `open:`](#partial-open-inherit-the-file-from-the-most-recent-authored-open)
  above.

**The `~` shorthand on a step.**

- For `demos` and `cover`, `~` means *explicitly empty for this
  step* — the screen has no demos / no cover even though the stage
  does.
- For `open`, `~` resets to `stage.open`. Use it when an earlier step
  changed files and a later step should re-land on the stage's
  authored target.

**Aliases must be unique within a stage.** The schema rejects duplicates.

#### Stage `demo:` / `demos:`

Two field names, both accepted; using both on the same stage/step is a
parse error. `demo:` takes a single object (shorthand for one
demo); `demos:` takes a list. Both normalise internally to
`Demo[]`.

```yaml
# Singular shorthand
demo:
  type: url
  src: https://example.com/demo

# Plural list — Run button shows a picker for >1
demos:
  - title: Live demo
    type: url
    src: https://example.com/demo
  - title: Recorded walkthrough
    type: video
    src: ./videos/demo.mp4
    startAt: 4.5
    stopAt: 32.0
    autoLaunch: end
```

##### URL demo

```yaml
type: url
src: https://example.com/demo
mode: external                 # optional — default: external
```

`src` must be `http://` or `https://`. Only `external` mode is
supported today (opens in the OS default browser).

##### Video demo

```yaml
type: video
src: ./videos/demo.mp4         # path relative to project root, or absolute http(s)
startAt: 4.5                   # optional — seconds
stopAt: 32.0                   # optional — pauses playback, shows Restart chip
autoLaunch: start              # optional — 'start' (or true), or 'end'
cues:                          # optional — auto-pause timestamps
  - 12.0                       # bare-number shorthand for `{ time: 12.0 }`
  - { time: 21.5, title: "Optional title for future use" }
```

Cues pause playback with a subtle Play chip; Space / PageDown /
chip-click resumes. Each cue fires once per session. A bare number is
shorthand for `{ time: <number> }`; use the object form when you want
to attach a `title`.

##### Optional `title:` (any demo kind)

`title:` on any demo entry serves as the row label in the picker
(falls back to the URL or video basename). Useful when two entries
share a `src` and the picker would otherwise show duplicate labels.

##### Optional `id:` (any demo kind)

```yaml
demo:
  id: backoffice-walkthrough
  type: video
  src: ./videos/walkthrough.mp4
```

`id:` makes the demo project-wide-addressable. A markdown file can
reference it via `[label](demo://backoffice-walkthrough)` — clicking
the link launches the demo regardless of which screen the link is
on. Duplicate ids resolve first-wins (the second declaration just
isn't reachable via `demo://`). See the
[markdown rendering guide](../guide/markdown) for the full link
grammar.

##### `autoLaunch` invariants

`autoLaunch` opens the modal automatically without a *Run* click. Two
modes; across a list, **at most one entry may have `autoLaunch:
'start'` and at most one `'end'`** — the schema rejects more.

- **`start`** (or shorthand `true`) — the "lead with a video"
  pattern: the modal opens on cross-screen entry to a screen whose
  autoStart entry is *new* relative to the previous screen.
- **`end`** — the "trail with a video" pattern: the modal opens on
  forward-advance *out of* a screen whose autoEnd entry differs by
  reference from the next screen's. The screen advance pauses, the
  video plays, and a carry-on close (atEnd Space, or natural video
  end) advances the deck in the same press.

Consecutive inheriting steps share the same list reference, so an
inherited autoLaunch entry doesn't re-fire on every step. Going
backward never re-fires, and once an `'end'` video has fired for its
scope it won't replay in the same session.

#### Stage `reset:` — declutter on cross-stage entry

```yaml
- id: preview
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

A list of items the presenter wants to remember to surface while in
this stage. Surfaced as a small clickable section under the file
tree. Two item shapes:

- **File entries** — a path (with optional `#id` / `@line`) the
  presenter wants to discuss. Tick once the file has been opened
  during the current stage's tenure.
- **Demo entries** — a `demo://<id>` reference to a project-wide
  demo `id:` (the same id markdown links use via
  `[label](demo://this-id)`). Click runs the demo, just like the
  *Run* button or a markdown demo link. Tick once the demo has been
  launched in the current stage's tenure.

```yaml
- id: preview
  cover:
    - src/dashboard.ts                         # bare path
    - src/api.ts#fetchDashboardData            # path#id shorthand
    - src/api.ts@42                            # path@line shorthand
    - file: src/dashboard.ts                   # full file object form
      id: renderCharts
      title: Chart helpers                     # optional — overrides the row's basename
    - demo://backoffice-walkthrough            # demo trigger shorthand
    - demo: backoffice-walkthrough             # demo object form
      title: Watch the walkthrough             # optional — overrides the row label
```

File items use the `path[#id][@line]` mini-grammar `open` accepts, or
the object form with `file` (required), `id?`, `line?`, `title?`.
Demo items use `demo://<id>` shorthand, or the object form with
`demo` (required) and `title?`. Mixing both kinds in one list is
fine — they share the surface.

`title` overrides the row's display text (otherwise the file's
basename or the resolved demo's title is shown). `id` (on a file
item) resolves through the same project-wide symbol table the
click-to-jump path uses.

`cover:` also accepts a **single item** (string or object, file or
demo) as a shorthand for a one-element list, mirroring how `demo:`
is the single-item form of `demos:`:

```yaml
cover: src/api.ts#fetchData          # shorthand for a one-item list
cover:                                # explicit list — same result
  - src/api.ts#fetchData
cover: demo://walkthrough            # demo single-item shorthand
```

**Inheritance.** Steps resolve `cover` stage→step only, exactly like
`demos`. An omitted step uses the stage default; a step's own value
replaces it; `cover: ~` clears it for that step. Cover does not
propagate across stage boundaries — each stage is its own agenda.

**Visited tracking.** "Visited" is keyed by file path for file
entries and by demo `id:` for demo entries. Both sets clear on every
cross-stage transition (forward, back, or via the dropdown). Opening
a file ticks every cover row pointing at it (regardless of which
anchor) and launching a demo ticks every cover row pointing at it
(regardless of where the launch came from — Run button, picker,
markdown link, autoLaunch, or the cover row itself).

When stepping within a stage, a step that authors its own `cover:`
(different reference from the previous step's resolved cover) clears
the tick on any file or demo id appearing in the new cover, so each
step's agenda starts fresh. Items visited under the previous step's
framing that aren't in the new cover stay ticked. Steps that inherit
the stage cover (no override) all resolve to the same list
reference, so they don't trigger a reset.

**Demo ids.** Cover demo entries resolve against the same
project-wide index markdown's `[label](demo://<id>)` does (built
from every stage's and step's `demo:` / `demos:` whose entries
declare an `id:`; first-wins on duplicates). An unresolved id
renders muted with a ⚠ — visible mistake without breaking the
agenda.

## Path normalisation

Wherever `prezl.yaml` (or a markdown link) names a project file,
the path is **project-root-relative** — `prezl.yaml` sits at the
project root, and that's the implicit base for `open:`, `cover:`,
markdown links, and any other path string the runtime resolves.

Two leading-shorthand forms are accepted as syntactic sugar and
normalised to the bare form before lookup:

- `./src/api.ts` — TypeScript / markdown muscle memory ("relative to
  here"). Stripped, including repeated `./` segments.
- `/src/api.ts` — read as "from project root", which is exactly the
  implicit base. The single leading slash is stripped.

Both resolve identically to `src/api.ts`. Protocol-relative URLs
(`//host/...`) are deliberately left untouched. Interior `./` and
`..` segments are not normalised — a path that tries to walk above
the project root is refused at the OS boundary, surfacing as a
load-time error rather than silently reaching outside the project.

## Notes

- YAML anchors / references are supported by the `yaml` parser Prezl
  uses, so you can DRY up repeated demo configs if you want.
- Trailing whitespace / alternate comment styles in YAML are fine; the
  parser is permissive.
- Changes to `prezl.yaml` require closing and reopening the project to
  take effect — there's no hot-reload on the manifest.
