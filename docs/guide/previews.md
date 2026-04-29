# Previews

Each stage (or step) can declare one or more **previews** — URLs and
fullscreen videos that the **Run** button launches. Screens with no
preview keep the Run button disabled; screens with one or more light it
up.

## The Run flow

1. Click **Run** (or press <kbd>F5</kbd> / <kbd>Ctrl</kbd>+<kbd>F5</kbd> / <kbd>Ctrl</kbd>+<kbd>Enter</kbd>).
2. If the screen has more than one preview, a **picker** opens —
   arrow keys cycle, Enter selects, Esc closes.
3. Status bar flashes `Preparing…` → `Ready` → `Launching preview…` →
   `Ready`. ~900 ms of dramatic pause to give the action a beat.
4. The chosen preview fires:
   - **URL preview** — hands the URL to the OS default browser and
     returns to idle.
   - **Video preview** — opens a fullscreen modal with the clip.

Only one preview is active at a time; the picker (and the autoLaunch
logic) won't stomp a modal that's already up.

## YAML shape — `preview:` vs `previews:`

Two field names, both accepted; using both on the same stage/step is a
parse error.

```yaml
# Singular shorthand — one preview, write the object directly.
preview:
  type: url
  src: https://example.com/dashboard

# Plural — explicit list of one or more previews.
previews:
  - type: video
    src: ./videos/intro.mp4
    autoLaunch: start
  - type: video
    src: ./videos/outro.mp4
    autoLaunch: end
  - type: url
    src: https://example.com/dashboard
```

Internally both shapes resolve to the same list. Use whichever reads
better — `preview:` for the common single-preview case, `previews:`
when an authored list reads more clearly than nesting an array under a
singular name.

## URL preview

```yaml
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
  - `'start'` (or shorthand `true`) — opens on cross-screen entry to a
    screen whose autoStart entry is *new* relative to the previous
    screen (the "lead with a video" stage intro).
  - `'end'` — opens on forward-advance *out of* a screen whose autoEnd
    entry differs by reference from the next screen's: the screen
    advance pauses, the video plays, and a carry-on close (atEnd
    Space, or natural video end) advances the deck in the same press.
    The "trail with a video" payoff for a section just walked through.

  Across a list, **at most one entry may have `autoLaunch: 'start'`
  and at most one `'end'`** — the schema rejects more. A start and an
  end on the same list is fine; they're independent slots.

  Because consecutive inheriting steps share the same list reference,
  an inherited autoLaunch entry doesn't re-fire on every step. Going
  backward never re-fires, and once an `'end'` video has fired for its
  scope it won't replay in the same session.

- **`cues`** — timestamps (seconds) where playback auto-pauses. Each
  cue fires once per session. Use them to pause over beats that need
  narration.

## Picker labels — `title:`

Each preview entry accepts an optional `title:` string. The picker uses
it as the row label (with the URL or video basename as fallback), so
two entries that share a `src` can still be distinguished:

```yaml
previews:
  - title: Wrap-up clip
    type: video
    src: ./videos/walkthrough.mp4
    autoLaunch: end
  - title: Full demo
    type: video
    src: ./videos/walkthrough.mp4
```

When the screen has just one preview the title is unused (Run launches
directly without opening the picker).

## Per-step preview overrides

A `preview:` (or `previews:`) declared on a step replaces the stage's
list for that screen — useful when one mid-build moment needs a
different launch target:

```yaml
- alias: shell
  previews:
    - type: url
      src: https://example.com/dashboard
  steps:
    - intro
    - alias: showApi
      open: src/api.ts#fetchDashboardData
    - alias: liveDemo
      preview:
        type: video
        src: ./videos/walkthrough.mp4
```

Resolution is **stage→step only** — there is **no step-to-step chain**:

- A step that omits `preview:` / `previews:` uses the **stage default**.
- A step that declares its own value uses that value (replaces the list
  wholesale; we don't merge).
- `preview: ~` (YAML null) means *explicitly empty for this step* —
  this screen has no previews even though the stage does.

So in the example above, `shell.intro` and `shell.showApi` both inherit
the stage's URL preview by stage→step inheritance; `shell.liveDemo`
swaps it for the video. Adding a fourth step that omits the field would
land back on the stage's URL preview — there's no carry-forward of
`liveDemo`'s override.

The same shape applies to `cover:` (omit → stage default, `~` →
explicitly empty, value → use it). `open:` shares the tri-state syntax
but its omitted-step semantics are different — see
[Stages](./stages#steps-within-a-stage).

### Controls while the video is up

| Input | Action |
| --- | --- |
| Move mouse | Fade in Close (×) + Pause chip |
| Stop moving (1.2 s) | Chrome fades back out |
| `Space` / `PageDown` / pause chip | Play / pause. At `stopAt`: close and continue. |
| Drag on the video | Scrub relative to the current playhead — drag right to go forward, left to go back. A progress bar with cue markers appears at the bottom while you drag, and fades back out on release. |
| Restart chip click | Replay from `startAt` — deliberate, nav keys won't do this |
| `Esc` / `PageUp` / × button | Close the preview |

Scrubbing back across a cue re-arms it, so the next forward pass fires
the cue again — handy for showing the same beat twice.

The clicker mapping is intentional — a presenter remote typically
emits PageUp / PageDown, so the same button that advances screens on
the editor surface also drives playback inside the video.

### Aspect ratio

Videos render with `object-fit: contain` against a black background,
so mismatched resolutions letterbox cleanly. Prezl never stretches or
unevenly scales. Record your clips at the resolution you want the
audience to see.
