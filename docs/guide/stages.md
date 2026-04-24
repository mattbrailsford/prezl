# Stages (branches)

A Prezl presentation is a sequence of **stages**, declared as `branches:` in
`prezl.yaml`. Each stage represents a moment in the story — typically a
point where new code has appeared, been highlighted, or a preview should
fire.

## Declaring a stage

```yaml
branches:
  - name: main
    alias: main
    title: Starting point
    order: 1
    open:
      file: src/main.ts
      line: 1
```

- **`name`** — the full branch name (think git-style, e.g.
  `feature/dashboard`). Free-form identifier.
- **`alias`** — a short handle used inside
  [`@prezl:*` directives](./directives). Required if this stage is
  referenced by any directive. Defaults to `name` if omitted.
- **`title`** — display label in the branch dropdown.
- **`order`** — integer. Controls the forward/backward sequence when
  stepping through with Space / PageDown. Must be unique.
- **`open`** — what to show when this stage becomes active. `file` is
  required; scroll target is either `line: 42` or `id: someMarkName` (see
  [Symbol navigation](./symbol-navigation)).

## Walking between stages

| Shortcut | Action |
| --- | --- |
| `Space` / `PageDown` | Next stage (by `order`) |
| `Shift+Space` / `PageUp` | Previous stage |
| Branch dropdown (titlebar) | Jump to any stage |

Prezl's keyboard handlers fire in capture phase so Monaco can't swallow
them, and they're suppressed while the video preview modal is open (so
Space/Esc belong to playback there).

## Stage-aware visibility

The directive grammar uses stage aliases in a small range syntax:

- `[shell]` — just that stage
- `[shell, preview]` — explicit list
- `[shell...preview]` — range, resolved by `order`
- `[shell...]` — shell onwards
- `[...preview]` — up to preview

Example: a file that only exists from the `shell` stage onwards, with a
focused region on `shell` and an additional import starting at `preview`:

```ts
// @prezl file=[shell...]

import type { App } from './framework'
// @prezl show=[preview...]
import { fetchDashboardData } from './api'
// @prezl end

// @prezl focus=[shell]
export function registerDashboard(app: App) { … }
// @prezl end
```

See [Directives](./directives) for the full grammar.

## Previews per stage

Any stage may declare a `preview:` — a URL or a video — that the Run button
triggers. See [Previews](./previews).

## Full example

```yaml
name: Umbraco Dashboard Demo
language: typescript
theme: dark

branches:
  - name: main
    alias: main
    title: Starting point
    order: 1
    open: { file: src/main.ts, line: 1 }

  - name: feature/dashboard-shell
    alias: shell
    title: Add dashboard shell
    order: 2
    open: { file: src/dashboard.ts, id: registerDashboard }

  - name: feature/dashboard-preview
    alias: preview
    title: Preview dashboard
    order: 3
    open: { file: src/dashboard.ts, id: registerDashboard }
    preview:
      type: url
      src: https://example.com/demo/dashboard
      mode: external

  - name: feature/recorded-demo
    alias: demo
    title: Recorded backoffice walkthrough
    order: 4
    open: { file: src/api.ts, line: 1 }
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
