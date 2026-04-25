# What is Prezl?

**Prezl is a code-first presentation environment disguised as a lightweight
IDE.** You structure a talk as a series of stages — typically modelled as
git branches — each with its own visible files, highlighted regions, and
optional preview (a URL or a video). Switching stages walks the audience
through the codebase while keeping the presenter firmly on rails.

Prezl sits between two unsatisfying options:

- **Slide decks** can't show how code evolves across files.
- **Live IDE demos** are fragile, noisy, and easy to derail.

Prezl looks and feels like a lightweight IDE, but it's **scripted**: code is
explorable *inside curated boundaries*, navigation is deterministic, and
nothing builds or runs for real.

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
      main.ts        ← ordinary source files, marked up with @prezl:* comments
      dashboard.ts
  videos/
    demo.mp4         ← optional: video previews referenced from prezl.yaml
```

The YAML declares stages. The source files carry inline `@prezl:*` comments
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
- [Directives](./directives) — the `@prezl:*` comment grammar
- [Previews](./previews) — URL and video scenes
- [Symbol navigation](./symbol-navigation) — clickable jumps and `Ctrl+T`
