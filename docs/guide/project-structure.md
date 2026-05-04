# Project structure

A Prezl project is any folder with a `prezl.yaml` manifest at its root.
The folder *is* the project root — your source files sit alongside the
manifest, the way they would in any normal repository.

## Folder layout

```
my-talk/
  prezl.yaml        # required — the manifest (and project marker)
  src/              # your source — anything you'd expect to see in
    main.ts          # the explorer
    dashboard.ts
    api.ts
  .prezl/           # optional — presentation-private assets
    intro.md         # markdown intros opened from `open:`
    videos/
      demo.mp4
```

- **`prezl.yaml`** declares the presentation flow: name, projects
  (optional), stages, demos. `prezl.yml` is also accepted as a fallback
  if you reach for the wrong extension out of habit. Paths in YAML
  (like `open.file`) and directives (`@prezl file=[...]`) are relative
  to this manifest's directory — the project root.
- **`.prezl/`** is the one allow-listed dotfolder. Files inside it load
  into the project but never appear in the explorer — perfect for
  presenter-only assets like markdown intros or demo videos.

The explorer shows everything else at the project root, minus the usual
noise: dotfolders (`.git`, `.idea`, `.vscode`), build outputs
(`node_modules`, `target`, `dist`, `bin`, `obj`), and the manifest
itself. So you can point Prezl at an existing repository without moving
anything.

## Minimal `prezl.yaml`

```yaml
name: My first demo

stages:
  - id: main
    branch: main
    title: Starting point
    open: src/main.ts
```

- `name` — shown in the Prezl titlebar.
- `stages` — one entry per stage. See [Stages](./stages) for the full
  shape.

## Multiple logical projects

If your talk covers a solution with multiple parts (a .NET backend, a React
frontend), declare them with a `projects:` list and Prezl's explorer will
render each as a distinct, color-coded top-level group.

```yaml
projects:
  - name: Backend
    path: src/Backend
    icon: dotnet
  - name: Frontend
    path: src/Frontend
    icon: typescript
```

See [Multi-project layout](./multi-project) for details including colour
resolution.

## What lives where — summary

| Thing | Lives in |
| --- | --- |
| Project metadata (name) | Top-level keys of `prezl.yaml` |
| Stages | `stages:` in `prezl.yaml` |
| Demo actions (URL / video) | On each stage, under `demo:` (one) or `demos:` (a list) |
| Which files are visible on which stage | `@prezl file=[...]` directives in each file |
| Which regions appear / fold / highlight | Inline `@prezl show / collapse / focus` directives |
| Named anchors for jumps | `@prezl id=<name>` directives inside code |
| Multi-project groups | `projects:` in `prezl.yaml` |

This keeps each concern where it naturally belongs. The YAML stays small and
declarative; the code stays readable and refactor-safe.
