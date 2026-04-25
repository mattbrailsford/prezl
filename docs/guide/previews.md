# Previews

Each stage can declare a **preview** — a URL or a fullscreen video that
fires when you hit Run. The Run button is disabled on stages without a
preview; stages with one light it up.

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
    order: 3
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
- **`stopAt`** — seconds at which to pause the playback. Replaces the
  Play chip with a **Restart** chip so you can re-run the segment
  without closing.
- **`cues`** — timestamps (seconds) where playback auto-pauses. Each
  cue fires once per session. Use them to pause over beats that need
  narration.

### Controls while the video is up

| Input | Action |
| --- | --- |
| Move mouse | Fade in Close (×) + Pause chip |
| Stop moving (1.2 s) | Chrome fades back out |
| `Space` / `PageDown` / pause chip | Play / pause / restart (at stopAt) |
| `Esc` / `PageUp` / × button | Close the preview |

The clicker mapping is intentional — a presenter remote typically
emits PageUp / PageDown, so the same button that advances stages on the
editor surface also drives playback inside the video.

### Aspect ratio

Videos render with `object-fit: contain` against a black background,
so mismatched resolutions letterbox cleanly. Prezl never stretches or
unevenly scales. Record your clips at the resolution you want the
audience to see.
