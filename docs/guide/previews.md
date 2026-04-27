# Previews

Each stage can declare a **preview** — a URL or a fullscreen video that
fires when you hit Run. The Run button is disabled on screens without a
preview; screens with one light it up.

## The Run flow

1. Click **Run** (or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd>).
2. Status bar flashes `Building…` → `Build succeeded` → `Launching
   preview…` → `Ready`. ~900 ms of fake build sequence to sell the
   illusion.
3. The preview fires:
   - **URL preview** — hands the URL to the OS default browser and
     returns to idle.
   - **Video preview** — opens a fullscreen modal with the clip.

## URL preview

```yaml
stages:
  - alias: preview
    branch: feature/dashboard-preview
    open: { file: src/dashboard.ts, id: registerDashboard }
    preview:
      type: url
      src: https://example.com/demo/dashboard
      mode: external
```

- **`src`** must be `http://` or `https://`.
- **`mode`** — only `external` is supported today (default if omitted).
  The URL opens in whatever the OS treats as the default browser. The
  Run button returns to its idle state immediately; Prezl doesn't own
  the browser window.

## Video preview

```yaml
preview:
  type: video
  src: ./videos/backoffice-demo.mp4
  startAt: 4.5
  stopAt: 32.0
  cues:
    - { time: 12.0 }
    - { time: 21.5 }
    - { time: 28.0 }
```

- **`src`** is a path relative to the project root, or an absolute
  `http(s)://` URL for hosted media. Videos typically live in a
  sibling `videos/` folder.
- **`startAt`** — seconds into the file to begin playback.
- **`stopAt`** — seconds at which to pause the playback. The Play chip
  is replaced with a **Restart** chip; clicking it replays from
  `startAt`. Forward nav (Space / PageDown) closes and returns to the
  deck — replaying is the rare deliberate case.
- **`autoLaunch`** — when set, the modal opens automatically without
  needing to click *Run*. Two modes:
  - `'start'` (or shorthand `true`) — opens the moment the presenter
    advances onto the screen. The "lead with a video" stage intro.
  - `'end'` — opens when the presenter forward-advances *out* of the
    screen: the screen advance pauses, the video plays, and a
    subsequent forward press leaves to the next screen normally. The
    "trail with a video" payoff for a section just walked through.

  Subsequent steps that inherit the same preview don't re-fire; an
  explicitly redeclared preview on a later screen does. Once an
  `'end'` video has fired for a given screen it won't replay in the
  same session, even if the presenter walks back through.
- **`cues`** — timestamps (seconds) where playback auto-pauses. Each
  cue fires once per session. Use them to pause over beats that need
  narration.

## Per-step preview overrides

A `preview:` declared on a step overrides the stage's preview for that
screen — useful when one mid-build moment needs to launch a different
URL or video:

```yaml
- alias: shell
  open: src/dashboard.ts
  preview:
    type: url
    src: https://example.com/dashboard
  steps:
    - intro
    - alias: showApi
      open: { file: src/api.ts, id: fetchDashboardData }
    - alias: liveDemo
      preview:
        type: video
        src: ./videos/walkthrough.mp4
```

Inheritance is **sticky-forward**: a step with no `preview:` inherits
the previous step's resolved preview (with the stage's preview seeding
step 1). So in the example above, `shell.intro` and `shell.showApi`
share the URL preview; `shell.liveDemo` swaps it for the video.
Subsequent steps after `liveDemo`, if any, would continue with the
video unless they re-state a preview themselves.

To swap previews mid-stage, re-state the one you want — there's no
"clear back to stage default" syntax, since the audience-facing
experience is "you stay in this preview context until the presenter
deliberately changes it."

### Controls while the video is up

| Input | Action |
| --- | --- |
| Move mouse | Fade in Close (×) + Pause chip |
| Stop moving (1.2 s) | Chrome fades back out |
| `Space` / `PageDown` / pause chip | Play / pause. At `stopAt`: close and continue. |
| Restart chip click | Replay from `startAt` — deliberate, nav keys won't do this |
| `Esc` / `PageUp` / × button | Close the preview |

The clicker mapping is intentional — a presenter remote typically
emits PageUp / PageDown, so the same button that advances screens on
the editor surface also drives playback inside the video.

### Aspect ratio

Videos render with `object-fit: contain` against a black background,
so mismatched resolutions letterbox cleanly. Prezl never stretches or
unevenly scales. Record your clips at the resolution you want the
audience to see.
