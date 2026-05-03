# Markdown intros

Sometimes the cleanest way to open a stage is a short README — an
agenda, a framing paragraph, a list of files you're about to walk
through. Prezl renders any `.md` file as styled markdown when it's
the active file, with prezl's own link shorthand wired into anchor
hrefs so links can jump to symbols, files, or demos.

## Where to put intro files

A repository convention: drop them under `files/.prezl/`. That
folder is **loaded** but never appears in the explorer tree, so
intros stay invisible to the audience while still being addressable
from `prezl.yaml`:

```
my-project/
├─ prezl.yaml
└─ files/
   ├─ .prezl/
   │  └─ intro.md          # not in the explorer
   └─ src/
      └─ dashboard.ts      # in the explorer
```

The `.prezl/` folder is the only allow-listed dotfolder in `files/`
— `.git/`, `.idea/`, etc. are still ignored as before.

You don't *have* to put intros under `.prezl/` — any `.md` file
renders as markdown when opened. Use `.prezl/` when you specifically
don't want the file to clutter the explorer.

## Wiring an intro to a stage

```yaml
- id: preview
  title: Preview the dashboard
  open: .prezl/intro.md
  cover:
    - src/dashboard.ts#registerDashboard
    - src/api.ts#fetchDashboardData
```

The stage's first screen (and any step that omits its own `open:`)
opens the intro. Closing the tab — or stepping forward into a step
with its own `open:` — moves on. See
[the stage open docs](./stages#per-stage-keys) for the full
resolution rules.

## Markdown features

Rendering uses GitHub-flavoured markdown: tables, task lists,
strikethrough, autolinks, fenced code blocks. Code blocks are
syntax-highlighted with the same Shiki theme as the code viewer, so
a `ts` fence in markdown matches a `.ts` file open in another tab.

Prezl's `@prezl` directives are accepted in markdown via the HTML
comment form:

```markdown
<!-- @prezl id=intro-section -->
## Files we'll touch

<!-- @prezl file=[shell, preview] -->
```

`file=[selector]` still gates the file per screen; `id=` registers
the position in the symbol table so other links can target it.
Region directives like `show=`, `collapse=`, `focus=` are parsed
but have no effect on the rendered output (they only make sense for
line-numbered code).

## Link grammar

Anchor hrefs in markdown are partitioned by shape:

### Files and symbols — `[label](path[#id][@line])`

Same shorthand as `open:` and `cover:`:

```markdown
- [Dashboard registration](src/dashboard.ts#registerDashboard)
- [Line 42 of api.ts](src/api.ts@42)
- [Fetcher (with both)](src/api.ts#fetchDashboardData@88)
```

Click navigates via the symbol table, exactly like a click on a
symbol decoration in code. Files already opened during the current
stage's tenure get a `✓` tick and a muted color — the same
visited tracking the cover list uses.

### Demos — `[label](demo://<id>)`

Give a demo an `id:` in `prezl.yaml` and any markdown file can
trigger it:

```yaml
demo:
  id: backoffice-walkthrough
  type: video
  src: ./videos/walkthrough.mp4
```

```markdown
[Watch the walkthrough](demo://backoffice-walkthrough)
```

Click runs the demo just like the *Run* button would. The link
renders with a small ▶ play affordance. Unresolved ids render
muted with a ⚠ — the page still shows but the click is a
no-op, so a typo is visible without breaking anything.

Demo ids are project-wide and resolve first-wins on duplicates. A
README on stage 1 can link to a demo declared on stage 5.

### In-document anchors — `[label](#some-id)`

Native browser scroll within the markdown view. Heading ids aren't
auto-generated; if you want a self-link target, drop a raw HTML
`<a id="some-id"></a>` next to the heading. Most intros are short
enough that a top-down read doesn't need internal anchors at all —
the prezl-flavoured `[label](path[#id])` form is what cross-stage
intros usually want.

### External — `https://`, `mailto:`, `tel:`, `ftp:`

Opens in the OS default handler via Tauri's shell plugin.

### Anything else

Left as a regular link. If the path doesn't resolve to a known
project file, prezl doesn't intercept the click — the browser
handles it however it would.

## Cover or markdown?

Both surface "files to discuss" — pick whichever fits:

- **Cover** is best for short YAML-driven agendas pinned next to the
  file tree. It's always visible during the stage; ticks update as
  you visit each file.
- **Markdown intros** are best for richer framing — heading,
  paragraph, links, demo triggers, GFM tables — viewed as the
  active file rather than a sidebar.

A stage can have both. They don't conflict; visited tracking is
shared (the same `visitedFilesInStage` set ticks both surfaces).
