---
layout: home
title: Prezl — staged code presentations
hero:
  name: Prezl
  text: Staged, IDE-like code presentations.
  tagline: >-
    A fake IDE that walks an audience through a codebase branch by branch —
    with explorable files, scripted reveals, fake build runs, and URL or
    fullscreen video previews.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/mattbrailsford/prezl
features:
  - icon: 🎯
    title: Branches as stages
    details: >-
      Each stage of your talk is a branch. Switch with the dropdown or a
      presenter clicker (PageUp / PageDown). Files and regions reveal
      themselves as the story progresses.
  - icon: ✍️
    title: Comment-directive reveals
    details: >-
      Mark visibility, folding, and highlights with simple
      <code>@prezl:*</code> comments colocated with the code they affect.
      Refactor-safe, language-agnostic, stripped from what the audience sees.
  - icon: 🎬
    title: Preview scenes
    details: >-
      Each stage can trigger a preview — a URL that opens in the default
      browser, or a fullscreen video with pause cues for talking over.
  - icon: 🔍
    title: Symbol quick-find
    details: >-
      Ctrl+T fuzzy-finds any named anchor across the project. Click an
      identifier to jump to its definition. No language server needed.
  - icon: 🧰
    title: Multi-project explorer
    details: >-
      Declare a <code>projects:</code> list to present solutions with
      multiple parts (Backend / Frontend / …) as distinct, color-coded
      top-level groups.
  - icon: 🖥️
    title: Custom chrome
    details: >-
      Decorated-free window, native-looking IDE frame, presentation zoom
      (Ctrl+= / Ctrl+Wheel), collapsible resizable explorer, fullscreen
      mode (F11). Designed for the stage.
---
