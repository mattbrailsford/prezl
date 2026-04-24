---
layout: home
title: Prezl — staged code presentations
hero:
  name: Prezl
  text: Present code like slides.
  tagline: >-
    An IDE built for the stage. Walk an audience through a codebase one
    branch at a time — files appear, regions fold and highlight themselves,
    and previews launch on cue.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/mattbrailsford/prezl
  image:
    src: /logo-pretzel.svg
    alt: Prezl
features:
  - icon:
      src: /icons/git-branch.svg
      width: 24
      height: 24
    title: Code progression, stage by stage
    details: >-
      Code changes over the course of a talk. Each stage is a branch;
      files, regions, and highlights reveal themselves only when the
      narrative calls for them — the audience never sees more than the
      current point needs.
  - icon:
      src: /icons/play.svg
      width: 24
      height: 24
    title: Demos with a safety net
    details: >-
      Live demos break. Record yours as a video, add pause cues to talk
      over, and fall back to the recording the moment the live version
      misbehaves — same flow, no awkward recovery.
  - icon:
      src: /icons/monitor.svg
      width: 24
      height: 24
    title: A real IDE, not a slide
    details: >-
      Developers read code fastest in the context they already know.
      Prezl looks and feels like an editor — file tree, tabs, syntax
      highlighting, <code>Ctrl+T</code> symbol jump — so the audience
      grasps structure quickly, and you can explore off-script when a
      question lands.
  - icon:
      src: /icons/message-code.svg
      width: 24
      height: 24
    title: Reveals that survive refactors
    details: >-
      Mark visibility, folding, and highlights with <code>@prezl:*</code>
      comments colocated with the code they affect. Refactor-safe,
      language-agnostic, stripped from what the audience sees.
  - icon:
      src: /icons/expand.svg
      width: 24
      height: 24
    title: Built for the projector
    details: >-
      Zoom with <code>Ctrl+Wheel</code>, go fullscreen with
      <code>F11</code>, drive stages from a presenter clicker
      (<code>PageDown</code> / <code>PageUp</code>). Every pixel is sized
      for the back row.
  - icon:
      src: /icons/layers.svg
      width: 24
      height: 24
    title: Multi-project layouts
    details: >-
      Got a backend + frontend? Declare them in <code>prezl.yaml</code>
      and they render as distinct, color-coded top-level nodes — the
      audience sees the shape of the system, not a flat folder dump.
---
