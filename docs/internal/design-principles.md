# Prezl — Design principles

The framing that scoped the original v1 work, kept around as a guide
for future changes. The codebase has shipped well past these notes —
this document deliberately avoids prescribing schema or feature lists,
and exists to remind us *why* we built what we built.

For current behaviour, see [`../guide/`](../guide) and
[`../reference/`](../reference). Architecture pointers live in
`CLAUDE.md` at the repo root.

## One-line concept

Prezl is a fake-IDE presentation environment for walking an audience
through a codebase, with staged reveals, explorable files, fake
build/run behaviour, and configurable demos such as URLs or
fullscreen videos.

## Core idea

Traditional slide decks are bad at showing code evolving across
multiple files. Real IDE demos are powerful but fragile, noisy, and
hard to keep on narrative rails.

Prezl sits between those two worlds:

- It looks and feels like a lightweight IDE.
- It is controlled like a presentation.
- The code is explorable, but only within curated boundaries.
- Branches (or the abstraction we call "stages") are the mental model
  for progression — not slides.
- Demo output can be launched per stage, without requiring the code
  to actually run.

The goal is not to build a real IDE. The goal is to create a
believable, deterministic, code-first presentation surface.

## Target users

Primary:

- conference speakers
- workshop presenters
- developer advocates
- trainers
- technical content creators

The canonical scenario: a speaker wants to present a codebase that
evolves over time, the talk involves multiple files, the audience
should understand how the code changes, and the presenter may want to
launch a related web page, staged demo, or video at certain points.

## Non-goals

Prezl should not attempt to:

- execute user code
- compile projects
- provide full language-server support
- be a general-purpose IDE
- perfectly clone VS Code
- provide real Git integration
- support arbitrary editing workflows
- support collaborative editing
- replace slide decks entirely

The product should feel IDE-like, but remain presentation-first.

## Design principles

### Controlled illusion

Everything should feel like a real development workflow, but the
behaviour should be deterministic and scripted.

The Run button does not actually build anything. It can show fake
build status. It then launches the configured demo for the current
screen.

### Code-first, not slide-first

The main surface is an IDE-like workbench, not a slide canvas.

### Branches as stages

Instead of "slide 1, slide 2, slide 3," Prezl uses branches as the
primary progression model. Each branch represents a curated state of
the codebase. Stages are the abstraction; branches are how we
visualise them — Prezl never actually touches git.

A stage may optionally declare intra-stage **steps** for build-style
sub-navigation (the same way a slide can fade in bullet points one at
a time), but those are still presentation-time mechanics layered on
top of the curated stage state.

### Explorable within boundaries

The presenter and audience should be able to explore visible files
and known symbol jumps. But Prezl should avoid uncontrolled behaviour
that could derail a talk.

### Presentation-safe by default

The experience should avoid common demo risks:

- no real build failures
- no real dependency installs
- no network dependency unless explicitly configured through demo URLs
- no unexpected editor diagnostics
- no distracting squiggles
- no noisy IDE panels

## UI tone

The UI should feel like a modern code workspace, not a novelty fake
VS Code clone.

Visual direction:

- dark theme first
- simple chrome
- readable code font
- high-contrast active states
- subtle borders
- minimal icons
- no noisy panels

Avoid:

- too many badges
- fake diagnostics everywhere
- exact VS Code clone styling
- overly animated slide-like transitions
