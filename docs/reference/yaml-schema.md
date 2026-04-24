# `prezl.yaml` schema

Complete reference for the manifest file. See [Project
structure](../guide/project-structure) for a higher-level overview.

## Top-level keys

```yaml
name: My Project            # required — shown in the Prezl titlebar
language: typescript        # optional — hint only
theme: dark                 # optional — "dark" (default) or "light"

projects:                   # optional — see Multi-project layout
  - { name: …, path: …, icon: …, color: … }

branches:                   # required — stages, at least one
  - { … }
```

### `name` (required, string)

Displayed in the titlebar.

### `language` (optional, string)

Display hint only. Prezl infers the actual Monaco language per file from
each file's extension; this key is not used for tokenization.

### `theme` (optional, `"dark"` | `"light"`)

Reserved. Dark is the only theme currently implemented.

### `projects` (optional, array)

Declares a multi-project layout. See the
[multi-project guide](../guide/multi-project). Each entry:

```yaml
- name: Backend              # required
  path: src/Backend          # required — path under files/
  icon: dotnet               # optional — glyph + color hint
  color: violet              # optional — overrides icon's default color
```

### `branches` (required, array)

At least one entry. Each entry is a stage of the presentation.

```yaml
- name: feature/dashboard    # required
  alias: shell                # optional — short handle for directives
  title: Add dashboard        # optional — dropdown label
  order: 2                    # required — integer, unique
  open:                       # optional — initial scroll target
    file: src/dashboard.ts    #   required if `open:` is present
    line: 1                   #   scroll target; line OR id, not both
    id: registerDashboard     #   resolves to a `@prezl id=<name>` anchor
  symbols: {}                 # reserved, not currently consumed
  preview:                    # optional — see Previews guide
    type: url | video
    …
```

#### Branch `preview:` — URL

```yaml
preview:
  type: url
  src: https://example.com/demo
  mode: external              # optional — default: external
```

`src` must be `http://` or `https://`. Only `external` mode is supported
today (opens in the OS default browser).

#### Branch `preview:` — video

```yaml
preview:
  type: video
  src: ./videos/demo.mp4      # path relative to project root, or absolute http(s)
  startAt: 4.5                # optional — seconds
  stopAt: 32.0                # optional — pauses playback, shows Restart chip
  cues:                       # optional — auto-pause timestamps
    - { time: 12.0, label: "Optional label for future use" }
```

Cues pause playback with a subtle Play chip; Space / PageDown /
chip-click resumes. Each cue fires once per session.

## Notes

- YAML anchors / references are supported by the `yaml` parser Prezl
  uses, so you can DRY up repeated preview configs if you want.
- Trailing whitespace / alternate comment styles in YAML are fine; the
  parser is permissive.
- Changes to `prezl.yaml` require closing and reopening the project to
  take effect — there's no hot-reload on the manifest.
