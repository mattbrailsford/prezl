# Project structure

A Prezl project is a folder containing a single `prezl.yaml` manifest and a
`files/` directory with the source files being presented.

## Folder layout

```
my-talk/
  prezl.yaml        # required — the manifest
  files/            # required — source files the editor renders
    src/
      main.ts
      dashboard.ts
      api.ts
  videos/           # optional — referenced by video previews
    demo.mp4
```

- **`prezl.yaml`** declares the presentation flow: name, projects
  (optional), stages, previews.
- **`files/`** is the root the Prezl editor shows. Paths in YAML (like
  `open.file`) and directives (`@prezl:file=[...]`) are relative to this
  directory.
- **`videos/`** (or any folder you like) holds media referenced from video
  previews. The YAML just points at a path relative to the project root.

You're free to add any other folders (a README, scripts, an `assets/` dir
for a README) — Prezl only touches what's inside `files/` and what's
referenced from `prezl.yaml`.

## Minimal `prezl.yaml`

```yaml
name: My first demo

stages:
  - alias: main
    branch: main
    title: Starting point
    open:
      file: src/main.ts
      line: 1
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
| Preview actions (URL / video) | On each stage, under `preview:` |
| Which files are visible on which stage | `@prezl:file=[...]` directives in each file |
| Which regions appear / fold / highlight | Inline `@prezl:show/collapse/focus` directives |
| Named anchors for jumps | `@prezl id=<name>` directives inside code |
| Multi-project groups | `projects:` in `prezl.yaml` |

This keeps each concern where it naturally belongs. The YAML stays small and
declarative; the code stays readable and refactor-safe.
