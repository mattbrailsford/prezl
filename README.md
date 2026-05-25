<p align="center">
  <img src="docs/public/logo-pretzel2.svg" alt="Prezl" width="120" />
</p>

<h1 align="center">Prezl</h1>

<p align="center"><strong>The clarity of slides. The context of real code.</strong></p>

<p align="center">
  <img src="assets/screenshot.png" alt="Prezl showing the Contoso Weather demo mid-stage" width="900" />
</p>

**📖 User docs**: [mattbrailsford.github.io/prezl](https://mattbrailsford.github.io/prezl/)

## What is it?

Slide decks are bad at showing code that evolves. Live IDE demos are powerful but fragile — one stray keystroke and your talk derails. Prezl sits between those two worlds:

- It **looks and feels** like a lightweight IDE.
- It's **controlled** like a presentation.
- Code is **explorable, but only within curated boundaries**.
- Progression through the talk is modelled as **stages** (often visualised as git branches), not slides.
- Each stage can optionally declare **steps** — build-style sub-navigation within a stage, the same way a slide can fade in bullet points one at a time.
- Each stage (or step) can launch one or more **demo scenes** — a URL, a fullscreen video with pause cues, etc. — without actually running any code.

The goal is not to build a real IDE. The goal is a believable, deterministic, code-first presentation surface for speakers, trainers, and DevRel.

## Who is it for?

- Conference speakers walking an audience through a codebase that changes over time.
- Workshop presenters and trainers who want a scripted, reliable demo.
- Developer advocates who need "real code" credibility without "real code" risk.
- Technical content creators recording a walkthrough.

## How it works

A Prezl project is any folder with a `prezl.yaml` manifest at its root —
your source files sit alongside the manifest, the way they would in any
normal repository. The YAML declares the stages of the presentation;
visibility, folding, and highlights come from inline `@prezl` comment
directives colocated with the code.

See the [user docs](https://mattbrailsford.github.io/prezl/) for the
full guide — project structure, stages, directives, demos, and the
YAML schema.

## Status

Pre-1.0, but the core experience is in place:

- Tauri 2 desktop app with custom window chrome
- Static, read-only code viewer (Shiki for tokens — no editor library)
- Markdown rendering for `.md` files (GFM, Shiki-highlighted fences, link shorthand including `demo://` references)
- Collapsible, resizable, project-grouped file explorer; `.prezl/` folder for presenter-private content (intros, videos, notes)
- Stage selector + Run button wired into the titlebar; Run opens a picker when a stage declares multiple demos
- `@prezl` directive system: `id`, `show`, `focus`, `collapse`, `file` — colocated with code, refactor-safe; selectors target stages or `stage.step` ids
- URL demos (open in default browser) and fullscreen video demos with pause cues for talking-over
- Click-to-jump symbol navigation
- Rider-style `Ctrl+T` fuzzy symbol finder
- Intra-stage **steps** (build-style sub-navigation within a stage)
- Stage **cover** (presenter agenda of files and demos surfaced under the file tree, ticked as they're visited or launched)
- `prezl://` deep links + back-to-presentation shortcut for slide-deck integration
- Companion VS Code extension for authoring directives and `prezl.yaml`
- Presentation-friendly UI zoom (`Ctrl+=` / `Ctrl+-` / `Ctrl+0` / `Ctrl+MouseWheel`), `Ctrl+E` to hide explorer, `F11` / `Fn+F` / `⌃⌘F` for fullscreen — all persisted across sessions

## Getting started (developers)

Prerequisites:

- Node.js 22+ and [pnpm](https://pnpm.io/)
- Rust toolchain (`rustup` + `cargo`)
- Platform build deps for Tauri 2 — see [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

```bash
pnpm install
pnpm tauri dev
```

## Tech stack

- [Tauri 2](https://tauri.app) — desktop shell (Rust + system webview)
- React 18 + TypeScript + Vite
- [Shiki](https://shiki.style) — VS Code-grade syntax highlighting via TextMate grammars (no editor library — Prezl renders the result as static HTML)
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Zustand](https://github.com/pmndrs/zustand) — state
- [Lucide](https://lucide.dev) — icons

## License

[ISC](./LICENSE) © Matt Brailsford
