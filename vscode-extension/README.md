# Prezl for VS Code

Authoring support for [Prezl](https://github.com/mattbrailsford/prezl) directives
and `prezl.yaml`.

## Features

- Syntax highlighting for `@prezl` / `@przl` comment directives across every
  language's comment scopes (`//`, `#`, `--`, `/* */`, `<!-- -->`, `@* *@`).
- Snippets for every directive shape (`pid`, `pshow`, `pfocus`, `pcollapse`,
  `pcollapsel`, `pfile`, `pend`). Region snippets auto-insert the matching
  `@prezl end`.
- Document and workspace symbols for `@prezl id=…` anchors. `Ctrl+Shift+O`
  inside a file, `Ctrl+T` across the project.
- Definition jumps:
  - In code: `Ctrl+click` a selector like `[shell.intro]` to open that
    stage at its `open` target.
  - In `prezl.yaml`: `Ctrl+click` an `id:` value to jump to the matching
    `@prezl id=` directive in the relevant file.
- Completion inside selector brackets: stage and `stage.step` aliases for
  `show=`/`focus=`/`file=`, open id list for `end=`.
- "Wrap Selection in Region" command (right-click in editor) — picks the
  region kind, prompts for a selector with completion, inserts the right
  comment syntax for the file's language.
- Stages tree view in the activity bar — click a stage or step to open its
  resolved file.
- JSON Schema validation for `prezl.yaml` (requires the Red Hat YAML
  extension, declared as a dependency).

## Out of scope (planned for later)

- Parser-driven diagnostics (mismatched `end=`, unknown selectors,
  `label=` without `collapse`). These need the Prezl parser to be shared
  as a package.
- Greying out hidden regions per "current screen" — needs a screen
  picker concept inside VS Code.
- Deep-link integration ("Open in Prezl").

## Development

```sh
pnpm install
pnpm --filter prezl-vscode build
```

Then press `F5` in VS Code with this folder open to launch an extension
host. Open `examples/demo/` from the parent repo to test against a real
project.
