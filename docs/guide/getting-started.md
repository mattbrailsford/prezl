# What is Prezl?

**Prezl is a presentation tool that looks and feels like a real code
editor.** Step through your codebase one moment at a time — reveal files,
focus regions, and trigger previews exactly when you need them. The
clarity of slides, the context of real code, none of the fragility of a
live demo.

A talk is structured as a series of **stages** — curated states of the
codebase, typically (but not necessarily) modelled as git branches.
Switching stages walks the audience through how the code evolves while
keeping the presenter firmly on rails: code is explorable inside curated
boundaries, navigation is deterministic, and nothing builds or runs for
real.

## Why another tool?

Prezl is built for:

- Conference speakers walking an audience through code that changes over
  time.
- Workshop presenters and trainers running repeatable demos.
- Developer advocates who want "real code" credibility without "real code"
  risk.
- Technical content creators recording a walkthrough.

If you've ever shared your terminal and muttered *"okay, let me zoom in…
wait, close that tab… no, not that one…"* — Prezl is trying to make that
never happen.

## How it works, in one minute

A Prezl project is a folder containing:

```
my-talk/
  prezl.yaml         ← the manifest: stages, previews, metadata
  files/
    src/
      main.ts        ← ordinary source files, marked up with @prezl comments
      dashboard.ts
  videos/
    demo.mp4         ← optional: video previews referenced from prezl.yaml
```

The YAML declares stages. The source files carry inline `@prezl` comments
that control what's visible, folded, or highlighted on each stage:

```ts
// @prezl file=[shell...]    ← this file only exists from `shell` onwards

export function registerDashboard(app) {
  // @prezl focus=[shell]    ← highlight these lines on the shell stage
  const dashboard = createDashboard()
  // @prezl end
}
```

At presentation time, Prezl parses the directives for the current stage,
strips them, and renders the result with VS Code-grade syntax highlighting
(Shiki / TextMate grammars) in a static, read-only viewer styled to feel
like an IDE.

## Installing Prezl

Prezl is a Tauri desktop app. See the
[repo README](https://github.com/mattbrailsford/prezl) for development
setup — packaged releases are coming as part of v1.

## Your first project

Once Prezl is running:

1. Click **Open project folder** on the welcome screen.
2. Pick any directory that contains a `prezl.yaml`. The bundled example at
   `examples/demo/` works out of the box.
3. Use the stage dropdown or press **Space / PageDown** to step through
   stages. **Shift+Space / PageUp** goes back.

That's it. Keep reading for:

- [Project structure](./project-structure) — what goes in `prezl.yaml` and
  `files/`
- [Stages](./stages) — how stages drive the presentation flow
- [Directives](./directives) — the `@prezl` comment grammar
- [Previews](./previews) — URL and video scenes
- [Symbol navigation](./symbol-navigation) — clickable jumps and `Ctrl+T`
