# VS Code extension

The Prezl VS Code extension turns ordinary editing of a Prezl project
into a first-class authoring experience. It adds syntax colouring for
`@prezl` directives, snippets for every directive shape, navigation
between directives and `prezl.yaml`, and a stages tree view so you
can jump straight to a stage's `open` target.

The extension lives in [`vscode-extension/`](https://github.com/mattbrailsford/prezl/tree/dev/vscode-extension)
in the repo. A `vscode-v*` release pipeline now ships signed `.vsix`
artifacts via GitHub Actions; Marketplace publication tracks those
tags. Until you see it in the Marketplace, install from a local build
or the latest GitHub Release.

## Installing

```sh
cd vscode-extension
pnpm install
pnpm package        # produces prezl-vscode-<version>.vsix
```

Then in VS Code: **Extensions** sidebar → **⋯** menu → **Install from
VSIX…** → pick the `.vsix`. Reload the window when prompted.

For active development on the extension itself, open `vscode-extension/`
as the workspace folder and press <kbd>F5</kbd>. That launches an
Extension Development Host pointed at `examples/demo/`. Edits to the
TypeScript trigger the esbuild watcher; reload the host
(<kbd>Ctrl</kbd>+<kbd>R</kbd>) to pick up changes.

## What you get

### Directive colouring

`@prezl` lines stand out from surrounding code: the keyword, attribute
names, selectors, and quoted values each get their own colour. Works in
every comment style the runtime accepts — `//`, `#`, `--`, `/* */`,
`<!-- -->`, `@* *@`.

Colouring runs through `TextEditorDecorationType` rather than relying
solely on TextMate grammar injection. That sidesteps a structural
limitation in C#'s grammar (its `//` comment rule consumes entire
continuation lines, blocking any injection inside multi-line `//`
blocks) and also overrides Roslyn's semantic-token reclassification.
Net effect: directives colour correctly in C#, F#, and any other
language whose grammar would otherwise swallow them — no user setting
required.

The contributed colours are themable. Override them in
`settings.json`:

```jsonc
"workbench.colorCustomizations": {
  "prezl.directive.keyword": "#ff79c6",
  "prezl.directive.attribute": "#8be9fd"
}
```

Available IDs: `prezl.directive.keyword`, `.attribute`, `.string`,
`.selector`, `.value`, `.punctuation`.

### Snippets

Type a prefix and tab through the placeholders. The right comment
syntax is inserted automatically for the file's language: line
comments (`//`, `#`, `--`) in languages that support them, block
comments (`/* */`, `<!-- -->`, `@* *@`) in HTML, XML, CSS, Razor, and
other languages without a single-line comment shape.

| Prefix | What it inserts |
| --- | --- |
| `pid` | `@prezl id=<name>` anchor |
| `pshow` | `show=[…] / end` block around selection |
| `pfocus` | `focus=[…] / end` block (highlight on listed screens) |
| `pfocusall` | `focus / end` block (always highlighted) |
| `pcollapse` | `collapse=[…] / end` block |
| `pcollapseall` | `collapse / end` block (always folded) |
| `pcollapsel` | collapse + `label="…"` placeholder |
| `pfile` | `@prezl file=[…]` file-level gate |
| `pend` | bare `@prezl end` |
| `pendid` | `@prezl end=<id>` matched close |

Region snippets (`pshow` / `pfocus` / `pcollapse` / `pcollapsel`) wrap
the current selection if there is one — select code, trigger the
snippet, the directives appear above and below.

### "Wrap Selection in Region"

Right-click any selection and pick **Prezl: Wrap Selection in
Region**. A picker asks for the region kind (`show`, `focus`,
`collapse`, …); a second prompt asks for a selector with
auto-complete over your project's stages and steps. The right comment
syntax is inserted for the file's language.

### Symbol navigation

- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> — list every `@prezl
  id=…` anchor in the current file.
- <kbd>Ctrl</kbd>+<kbd>T</kbd> — fuzzy search anchors across the
  whole project. Same shape as Prezl's runtime Symbol Finder.

### Go-to definition

- **In code** — <kbd>Ctrl</kbd>+click a selector like `[shell.intro]`
  inside a directive to jump to that screen's `open` target in
  `prezl.yaml`.
- **In `prezl.yaml`** — <kbd>Ctrl</kbd>+click an `id:` value to jump
  to the matching `@prezl id=` directive in the relevant file.

### Selector completion

Inside `[ ]` brackets the extension suggests stage and `stage.step`
aliases pulled from the open `prezl.yaml`. Triggers on `[`, `,`,
`.`, and after `=`. For `end=` the completion list narrows to ids
that have an unclosed open region above.

### Stages tree

A **Prezl** activity-bar item shows a tree of every stage and step.
Clicking a node opens that screen's resolved `open` file at the
right line — a quick way to jump around while authoring. The
view appears whenever the workspace contains a `prezl.yaml`.

### `prezl.yaml` schema validation

`prezl.yaml` and `prezl.yml` get JSON-schema-backed validation:
inline errors for unknown keys, required fields, and type
mismatches; completions for stage shape; hover docs on each
property. The bundled schema tracks the runtime shape — including
stage / step `cover:`, the tri-state `null` reset for `open` /
`preview` / `cover`, and the `path#anchorId` cover shorthand — so
authoring lines up with what the app actually accepts. Powered by
the Red Hat YAML extension (declared as a dependency, so it
installs automatically).

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| `prezl.projectFile` | `prezl.yaml` | Workspace-relative path to the project file. Falls back to `prezl.yml` if the configured name isn't found. |

That's the full surface area today. Open an issue if you'd like
something else exposed.
