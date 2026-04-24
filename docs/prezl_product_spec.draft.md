# Prezl — Product & Technical Spec

## 1. Working name

**Prezl**

A staged, IDE-like code presentation and exploration tool. The name is a codename for now, derived from “presentation”.

## 2. One-line concept

Prezl is a fake-IDE presentation environment for walking an audience through a codebase branch by branch, with staged reveals, explorable files, fake build/run behavior, and configurable previews such as URLs or fullscreen videos.

## 3. Core idea

Traditional slide decks are bad at showing code evolving across multiple files. Real IDE demos are powerful but fragile, noisy, and hard to keep on narrative rails.

Prezl sits between those two worlds:

- It looks and feels like a lightweight IDE.
- It is controlled like a presentation.
- The code is explorable, but only within curated boundaries.
- Branches are used as the mental model for stages.
- Preview output can be launched per branch, without requiring the code to actually run.

The goal is not to build a real IDE. The goal is to create a believable, deterministic, code-first presentation surface.

## 4. Target users

Primary users:

- conference speakers
- workshop presenters
- developer advocates
- trainers
- technical content creators

Initial use case:

- a speaker wants to present a codebase that evolves over time
- the talk involves multiple files
- the audience should understand how the code changes
- the presenter may want to launch a related web page, staged demo, or video at certain points

## 5. Non-goals

Prezl v1 should not attempt to:

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

## 6. Design principles

### 6.1 Controlled illusion

Everything should feel like a real development workflow, but the behavior should be deterministic and scripted.

Example:

- The Run button does not actually build anything.
- It can show fake build status.
- It then launches the configured preview for the current branch.

### 6.2 Code-first, not slide-first

The main surface is an IDE-like workbench, not a slide canvas.

### 6.3 Branches as stages

Instead of “slide 1, slide 2, slide 3”, Prezl should use branches as the primary progression model.

Example branches:

- `main`
- `feature/dashboard`
- `feature/dashboard-api`
- `feature/dashboard-complete`

Each branch represents a curated state of the codebase.

### 6.4 Explorable within boundaries

The presenter and audience should be able to explore visible files and known symbol jumps. But Prezl should avoid uncontrolled behavior that could derail a talk.

### 6.5 Presentation-safe by default

The experience should avoid common demo risks:

- no real build failures
- no real dependency installs
- no network dependency unless explicitly configured through preview URLs
- no unexpected editor diagnostics
- no distracting squiggles
- no noisy IDE panels

## 7. MVP feature set

### 7.1 Fake IDE shell

The app should have:

- top title bar
- branch selector
- fake Run button
- left file explorer
- editor tabs
- Monaco-based code editor
- bottom status bar

Optional later:

- command palette
- fake terminal
- presenter notes
- stage thumbnails

### 7.2 Branch-based stage system

Each branch defines:

- branch name
- display title
- visible files
- visible line ranges per file
- initially opened file
- focused line range
- symbol navigation map
- optional preview action

### 7.3 File explorer

The file explorer should:

- show only files visible for the current branch
- preserve folder hierarchy
- highlight the active file
- allow opening visible files
- optionally animate newly revealed files on branch change

### 7.4 Code editor

Use Monaco Editor for:

- syntax highlighting
- line numbers
- editor tabs
- scrolling
- read-only code display
- decorations for focus/highlight ranges

Editor should disable or hide:

- squiggly diagnostics
- minimap by default
- inline suggestions
- hover noise unless explicitly needed
- editing by default

Initial mode: read-only.

Editing can be considered later, but is not part of v1.

### 7.5 Visible line ranges

Each branch can reveal full files or only specific line ranges.

Possible behavior:

- hidden lines are removed from the displayed model
- or hidden ranges are collapsed into placeholder blocks

Recommendation for v1:

- collapse hidden ranges with a subtle placeholder such as:

```text
// … hidden until later
```

This preserves line context without overwhelming the audience.

### 7.6 Symbol navigation

Prezl should support fake “go to implementation”.

This should be metadata-driven, not language-server-driven.

Example:

```yaml
symbols:
  parseUser:
    file: src/parser.ts
    line: 12
    branch: feature/parser
```

Behavior:

- clickable symbol or configured text range jumps to target file and line
- opens target file if visible
- if target file is not visible in current branch, either:
  - do nothing
  - show a subtle “not available on this branch” message
  - optionally switch to the branch where it exists if configured

Recommendation for v1:

- only jump within currently visible branch state
- keep it deterministic

### 7.7 Branch switching

Presenter can switch branches via:

- branch dropdown
- keyboard shortcuts
- next/previous branch controls

On branch switch:

- visible file tree updates
- open tabs are reconciled
- initial file may open
- focus range may be highlighted
- status bar shows a fake checkout message briefly

Example status messages:

```text
Checking out feature/dashboard...
Ready
```

### 7.8 Run / Preview button

The Run button is a fake IDE action.

It should:

- be enabled only if the current branch has a preview
- show a short fake build/launch flow
- then launch the configured preview

Possible fake status sequence:

```text
Building...
Build succeeded
Launching preview...
```

Preview types in v1:

- URL
- video

### 7.9 URL preview

A branch may define a URL preview.

Example:

```yaml
preview:
  type: url
  src: https://example.com/demo/dashboard
  mode: external
```

Possible launch modes:

- `external`: open in default browser
- `window`: open in a dedicated app window
- `pane`: embed inside the Prezl UI

Recommendation for MVP:

- support `external` first
- design the schema so `window` and `pane` can be added later

### 7.10 Video preview

A branch may define a fullscreen video preview.

Example:

```yaml
preview:
  type: video
  src: ./videos/dashboard-demo.mp4
  startAt: 8.5
  stopAt: 20.0
  cues:
    - time: 12.0
    - time: 18.2
```

Video preview should support:

- fullscreen or near-fullscreen playback
- autoplay after Run action
- `startAt`
- `stopAt`
- pause cues
- space to resume/pause
- escape to close

Cue behavior:

- when playback reaches a cue time, pause automatically
- show a subtle overlay such as “Press space to continue”
- prevent cue from retriggering repeatedly

### 7.11 Keyboard controls

Recommended default shortcuts:

| Shortcut | Action |
| --- | --- |
| Right arrow / PageDown | Next branch |
| Left arrow / PageUp | Previous branch |
| Cmd/Ctrl+P | Open file picker |
| Cmd/Ctrl+Enter | Run preview |
| Space | Resume video when video preview is active |
| Esc | Close preview / exit modal |

Avoid overriding browser/system shortcuts unnecessarily.

## 8. Example project structure

```text
prezl-demo/
  prezl.yaml
  files/
    src/
      main.ts
      dashboard.ts
      api.ts
      parser.ts
  videos/
    dashboard-demo.mp4
  assets/
    logo.svg
```

## 9. Example `prezl.yaml`

```yaml
project:
  name: Umbraco Dashboard Demo
  language: typescript
  theme: dark

branches:
  - name: main
    title: Starting point
    order: 1
    files:
      - path: src/main.ts
        ranges:
          - 1-24
    open:
      file: src/main.ts
      line: 1
    focus:
      file: src/main.ts
      range: 10-18

  - name: feature/dashboard-shell
    title: Add dashboard shell
    order: 2
    files:
      - path: src/main.ts
        ranges:
          - 1-40
      - path: src/dashboard.ts
        ranges:
          - 1-32
    open:
      file: src/dashboard.ts
      line: 1
    focus:
      file: src/dashboard.ts
      range: 8-24
    symbols:
      registerDashboard:
        file: src/dashboard.ts
        line: 8

  - name: feature/dashboard-preview
    title: Preview dashboard
    order: 3
    files:
      - path: src/main.ts
        ranges:
          - 1-40
      - path: src/dashboard.ts
        ranges:
          - 1-60
      - path: src/api.ts
        ranges:
          - 1-28
    open:
      file: src/dashboard.ts
      line: 34
    focus:
      file: src/dashboard.ts
      range: 34-52
    preview:
      type: url
      src: https://example.com/umbraco-demo/dashboard
      mode: external

  - name: feature/recorded-demo
    title: Recorded backoffice walkthrough
    order: 4
    files:
      - path: src/main.ts
        ranges:
          - 1-40
      - path: src/dashboard.ts
        ranges:
          - 1-80
      - path: src/api.ts
        ranges:
          - 1-50
    open:
      file: src/api.ts
      line: 1
    preview:
      type: video
      src: ./videos/backoffice-demo.mp4
      startAt: 4.5
      stopAt: 32.0
      cues:
        - time: 12.0
        - time: 21.5
        - time: 28.0
```

## 10. Data model

### 10.1 Core TypeScript types

```ts
type PrezlProject = {
  project: ProjectMeta
  branches: Branch[]
}

type ProjectMeta = {
  name: string
  language?: string
  theme?: 'light' | 'dark'
}

type Branch = {
  name: string
  title?: string
  order: number
  files: BranchFile[]
  open?: OpenTarget
  focus?: FocusTarget
  symbols?: Record<string, SymbolTarget>
  preview?: Preview
}

type BranchFile = {
  path: string
  ranges?: string[]
}

type OpenTarget = {
  file: string
  line?: number
}

type FocusTarget = {
  file: string
  range: string
}

type SymbolTarget = {
  file: string
  line: number
}

type Preview = UrlPreview | VideoPreview

type UrlPreview = {
  type: 'url'
  src: string
  mode?: 'external' | 'window' | 'pane'
}

type VideoPreview = {
  type: 'video'
  src: string
  startAt?: number
  stopAt?: number
  cues?: VideoCue[]
}

type VideoCue = {
  time: number
  label?: string
}
```

## 11. Recommended technical stack

### 11.1 Frontend

- React
- TypeScript
- Monaco Editor
- Zustand or another small state store
- YAML parser
- CSS modules, Tailwind, or plain CSS

### 11.2 Desktop wrapper

For v1, two viable paths:

#### Option A: Web app first

Build Prezl as a local web app first.

Pros:

- fastest iteration
- easy to test
- easy to host/share

Cons:

- less native fake-IDE feel
- external file/video handling may need care

#### Option B: Tauri or Electron wrapper

Wrap the app as a desktop application.

Pros:

- better fake IDE illusion
- easier fullscreen video/window control
- easier local asset handling

Cons:

- more build/distribution complexity

Recommendation:

- build the core as a web app first
- keep platform APIs abstracted
- wrap later if needed

## 12. Main components

### 12.1 AppShell

Owns the main layout:

- title bar
- toolbar
- explorer
- editor area
- status bar
- preview modal/window

### 12.2 BranchSelector

Displays current branch and allows switching.

### 12.3 ExplorerTree

Displays files visible in the current branch.

### 12.4 EditorTabs

Displays currently opened files.

### 12.5 CodeEditor

Monaco wrapper.

Responsibilities:

- display active file
- apply visible ranges
- apply focus decorations
- register click handlers for fake symbol navigation

### 12.6 StatusBar

Shows:

- current branch
- language mode
- fake build/checkout messages
- ready state

### 12.7 RunButton

Triggers current branch preview.

### 12.8 PreviewController

Launches preview based on type.

Responsibilities:

- URL launch
- video launch
- fake build timing
- preview close behavior

### 12.9 VideoPreview

Fullscreen video player with cue support.

Responsibilities:

- seek to startAt
- autoplay
- pause at cues
- stop at stopAt
- keyboard handling
- close on Escape

## 13. State model

Suggested app state:

```ts
type AppState = {
  project: PrezlProject
  currentBranchName: string
  openTabs: string[]
  activeFile?: string
  statusMessage: string
  previewState: PreviewState
}

type PreviewState =
  | { kind: 'closed' }
  | { kind: 'launching'; preview: Preview }
  | { kind: 'video'; preview: VideoPreview }
  | { kind: 'url'; preview: UrlPreview }
```

## 14. Branch switching behavior

When switching branch:

1. Set status message to `Checking out <branch>...`.
2. Update current branch.
3. Recalculate visible file tree.
4. Remove open tabs that are no longer visible.
5. Open configured branch `open.file` if present.
6. Scroll to configured line if present.
7. Apply focus decoration if present.
8. Set status message to `Ready`.

## 15. Run behavior

When Run is clicked:

1. If no preview exists, do nothing or show `No preview configured`.
2. Set status message to `Building...`.
3. Wait a short configurable delay.
4. Set status message to `Build succeeded`.
5. Wait briefly.
6. Set status message to `Launching preview...`.
7. Launch preview.
8. Set status message to `Ready`.

Fake delays should be short and optional.

Recommended defaults:

- build delay: 600ms
- launch delay: 300ms

## 16. Video cue behavior

Algorithm:

1. Load video.
2. Seek to `startAt` or `0`.
3. Wait for seek to complete.
4. Play.
5. On `timeupdate`, check next unconsumed cue.
6. If current time >= cue time, pause and mark cue consumed.
7. Show overlay: `Press space to continue`.
8. If `stopAt` is defined and current time >= stopAt, pause or close depending on configuration.

Important:

- use a tolerance to avoid missed cues
- sort cues by time
- ignore cues earlier than `startAt`
- reset cue state each time the video preview is launched

## 17. UI tone

The UI should feel like a modern code workspace, not a novelty fake VS Code clone.

Visual direction:

- dark theme first
- simple chrome
- readable code font
- high contrast active states
- subtle borders
- minimal icons
- no noisy panels

Avoid:

- too many badges
- fake diagnostics everywhere
- exact VS Code clone styling
- overly animated slide-like transitions

## 18. MVP milestones

### Milestone 1 — Static shell

- render fake IDE layout
- load hardcoded project
- show explorer
- show Monaco editor
- open files from explorer

### Milestone 2 — Branch system

- parse `prezl.yaml`
- switch branches
- show branch-specific files
- branch selector
- next/previous shortcuts

### Milestone 3 — Reveals and focus

- support visible ranges
- support focus decorations
- apply open file and scroll position per branch

### Milestone 4 — Run URL preview

- add fake Run button
- add preview config
- support URL preview in external browser

### Milestone 5 — Video preview

- fullscreen video modal
- `startAt`
- `stopAt`
- pause cues
- keyboard controls

### Milestone 6 — Symbol navigation

- metadata-driven symbol targets
- click-to-jump behavior
- destination range flash/highlight

## 19. Open questions

1. Should hidden lines be removed, collapsed, or dimmed?
2. Should future branches be locked until reached?
3. Should branch switching be freeform or linear by default?
4. Should previews open in external browser, embedded pane, or separate desktop window?
5. Should Prezl projects be authored entirely in YAML, or should a small visual editor exist later?
6. Should file contents be read from disk, embedded in the YAML, or both?
7. Should there be a presenter notes panel?
8. Should code be editable at all, or strictly read-only?

## 20. Recommended v1 decisions

For the first coding session, choose:

- React + TypeScript
- Monaco Editor
- YAML project file
- read file contents from local project folder during development
- read-only editor
- branches as stages
- visible files per branch
- visible ranges per branch
- URL preview via external browser
- video preview via fullscreen modal
- no real Git
- no real build
- no code execution
- no real language server

## 21. Minimum viable demo scenario

Build a demo project with four branches:

1. `main`
   - one visible file
   - no preview

2. `feature/dashboard-shell`
   - second file appears
   - focus range highlights dashboard registration

3. `feature/dashboard-preview`
   - API file appears
   - Run opens URL preview

4. `feature/recorded-demo`
   - Run opens fullscreen video
   - video starts at 4.5s
   - pauses at configured cue points

This will prove the core concept without overbuilding.

## 22. Summary

Prezl is a code-first presentation environment disguised as a lightweight IDE. It uses branches as narrative stages, metadata-driven file and code reveals, deterministic fake navigation, and configurable preview scenes.

The first version should be intentionally simple: no real building, no real Git, no real execution. The value is in controlled exploration, visual credibility, and reliable storytelling.

