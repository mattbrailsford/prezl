# Live follow-along sessions — design notes

Status: **parked, future work.** This is an internal design doc, not
a roadmap commitment. Captured so we have something concrete to react
to when we pick the feature up.

## Context

Presenting code is hard to follow at the back of a room or over a laggy
screen-share. Idea: when the presenter is ready, they flip a "broadcast"
toggle in Prezl. The desktop app starts a small HTTP+WS server on the
LAN. Audience members open a URL on their phone or laptop and see the
same Prezl view as the presenter — same explorer, same active file,
same focus highlights, same fold state — updating live as the presenter
walks the deck.

Goal of v1: works at an in-person conference (LAN-only, no cloud, no
accounts, zero ops on the presenter's machine). Online streaming via a
cloud relay is a clear follow-up but is out of scope here.

The renderer is already cleanly factored: `CodeView`, `ExplorerTree`,
`EditorTabs`, the directive parser, Shiki setup, and all the
`useRenderedFile.*` hooks are pure TS with no Tauri imports. Tauri
integration is concentrated in `useProjectLoader`,
`usePreferencesPersistence`, `useDeepLink`, `TopBar`, and a few
specific commands. So the viewer can reuse the renderer almost
verbatim.

## Architecture

```
Presenter desktop                       Audience browser
┌────────────────────────────┐          ┌────────────────────────────┐
│ Tauri webview              │          │ Viewer SPA (embedded,      │
│   <App> (presenter mode)   │          │   served by Rust)          │
│   store mutations          │          │   <ViewerShell>            │
│       ↓                    │          │   reads project bundle +   │
│   subscribe → invoke       │          │   subscribes to /api/ws    │
│     broadcast_state(...)   │          └────────────────────────────┘
│       ↓                    │                  ↑       ↑
│ Rust broadcast module      │          HTTP /api/bundle │
│   axum on 0.0.0.0:<port>   │ ←──────  WS   /api/ws ────┘
│   /            embedded SPA│
│   /assets/*    embedded    │
│   /api/bundle  project JSON│
│   /api/ws      state stream│
└────────────────────────────┘
```

One process. The Rust server is started/stopped by a Tauri command
from the frontend. Audience traffic never leaves the LAN. Same origin
for SPA + API + WS, so no CORS plumbing.

## Data model

Decision: **mirror mode** for v1 — audience sees exactly what the
presenter sees. Streamed events:

```ts
type StateEvent = {
  type: 'state'
  screenId: string
  activeFile: string | null
}

type BundleEvent = {
  type: 'bundle-changed'   // presenter loaded a different project
}
```

Audience's local store has `currentScreenId` and `activeFile` driven
entirely by these events. No user input on the audience side mutates
them. Folding, tab list, and visible-files all derive from those two
values the same way they do on the desktop today
(`reconcileScreenSwitch`, `useVisibleFiles`, the directive parser).
The viewer's local fold state re-seeds from `RenderedFile.foldRanges`
on every screen/file change, identical to the desktop.

What's **not** streamed in v1:

- Scroll position. Audience scrolls freely within the current file.
- Live fold toggles. Audience folds independently.
- Symbol-jump navigation (`pendingNavigation`). Transient anyway.
- Tab list mutations. Tabs reconcile deterministically from screenId.

Future "follow mode" with independent scroll-but-snap-back, presenter
cursor, and viewer count is parked.

## Phasing

### Phase A — Render-only viewer factor

Goal: produce a `<ViewerShell>` React tree that takes a `Project` plus
`(screenId, activeFile)` props (controlled) and renders the same
Explorer + Tabs + CodeView, with no Tauri imports anywhere downstream.

Work:

- New `src/viewer/ViewerShell.tsx`. Same composition as `AppShell`
  minus `TopBar`, minus the Explorer header buttons (no folder picker,
  no hide toggle), minus any "open project" / preferences plumbing.
  Status bar replaced with a slim "Following \<presenter\>" /
  "Reconnecting…" badge.
- New `src/viewer/main.tsx` entry that mounts `<ViewerShell>`, no
  `useDeepLink`, no `usePreferencesPersistence`, no `useProjectLoader`.
- Reuse the existing Zustand store for ergonomics, but skip the
  preferences / recents / history actions on the viewer side. Add a
  helper `applyViewerEvent(event)` in `state/store.ts` that maps a
  `StateEvent` onto `(currentScreenId, activeFile)` and drives
  `reconcileScreenSwitch` the same way `switchScreen` does.
- Shiki / directive parser / `useVisibleFiles` / `useActiveRenderedFile`:
  reuse as-is (already pure).
- Confirm: nothing in `CodeView.tsx`, `ExplorerTree.tsx`,
  `EditorTabs.tsx` imports `@tauri-apps/api/*` — fix any leaks.

Vite multi-entry config:

- Add `viewer.html` at repo root with its own root id.
- Update `vite.config.ts` to declare two entries (`index.html`,
  `viewer.html`); main app build still bundles into `dist/` for Tauri,
  viewer build emits `dist-viewer/`.
- Keep dev story: `pnpm tauri dev` is unchanged; add `pnpm dev:viewer`
  that runs vite against the viewer entry on a side port for ad-hoc
  testing against a stub project.

### Phase B — Rust HTTP+WS server

Goal: Tauri command starts a server that serves the viewer SPA +
project bundle + WS state stream.

Cargo additions (`src-tauri/Cargo.toml`):

- `axum = "0.7"` (HTTP + built-in WS via `axum::extract::ws`)
- `tokio = { version = "1", features = ["rt-multi-thread", "sync", "net", "macros"] }`
- `tokio-stream = "0.1"`
- `rust-embed = "8"`
- `local-ip-address = "0.6"` (resolve LAN IP for the URL we display)
- `nanoid = "0.4"` (session token + viewer ids)

New module `src-tauri/src/broadcast.rs`:

- `pub struct BroadcastState` — managed via `app.manage()`. Holds
  `Mutex<Option<RunningServer>>` and a
  `tokio::sync::broadcast::Sender<StateEvent>` for fan-out.
- `RunningServer` — handle to the spawned task, shutdown signal sender,
  `host: String`, `port: u16`, `session_id: String`.
- New Tauri commands (`commands.rs`):
  - `start_broadcast(state, project_root) -> StartBroadcastResult` —
    picks a port (try 9876, walk forward on `EADDRINUSE`), generates a
    short `session_id`, spawns axum, returns `{ url, sessionId, port }`.
    URL is `http://<lan-ip>:<port>/s/<sessionId>`.
  - `stop_broadcast()` — sends shutdown, drops the tokio task.
  - `broadcast_state(payload)` — frontend calls this when
    `(currentScreenId, activeFile)` changes; pushes onto the broadcast
    channel.
- Server routes:
  - `GET /` and `GET /s/:sid` — return embedded `viewer.html`
  - `GET /assets/*path` — served from `RustEmbed` (`dist-viewer/`)
  - `GET /api/bundle?session=...` — returns `{ manifest: string,
    rootPath: string, files: { [path: string]: string } }` — the YAML
    string and a flat map of every file under `<root>` (excluding the
    manifest, dotfolders other than `.prezl/`, and standard build dirs).
    Reuses
    `commands::list_project_files` + `commands::read_project_file`
    internals (factor the path-escape check into a shared helper).
  - `GET /api/ws?session=...` — websocket; on connect, send the
    current last-known `StateEvent` so a late-joining viewer is in
    sync; then forward every event from the broadcast channel.
- Session check: every `/api/*` route validates `?session=` against
  the running session id; mismatch → 404. Acts as a capability token.
- Bundle the built viewer:
  ```rust
  #[derive(RustEmbed)]
  #[folder = "../dist-viewer/"]
  struct ViewerAssets;
  ```
  `tauri.conf.json` `beforeBuildCommand` runs
  `pnpm build && pnpm build:viewer` so both bundles exist before cargo
  compiles.

Capabilities (`src-tauri/capabilities/default.json`): allow the new
commands.

Firewall: first start binds `0.0.0.0:<port>`; on Windows this triggers
the firewall dialog. Document in the user-facing guide; no code
workaround.

### Phase C — Status-bar UI

Goal: presenter can start/stop a session and share the URL with one
click.

Work:

- New `src/components/BroadcastControls.tsx` — sits in the StatusBar
  next to `StatusBarLinkControls`. States:
  - idle: broadcast icon, button label "Broadcast"
  - starting: spinner, disabled
  - active: filled icon, label "Broadcasting · \<viewer count\>"
  - error: warning icon + tooltip
- Click idle → invokes `start_broadcast`, opens popover with: LAN URL,
  QR code, session id, copy-link button, stop button.
- Click active → opens the same popover (so presenter can re-share
  URL mid-talk) plus a stop button.
- QR code: tiny dependency, `qrcode` (3KB). Render the URL directly
  into a `<canvas>`.
- Toast on start failure (port range exhausted, etc.).
- `usePreferencesPersistence` gets a new `lastBroadcastPort` so we
  remember the last successful port between launches.

### Phase D — Presenter → server bridge

Goal: state changes on the presenter side become WS events on the
audience side.

Work:

- New hook `src/hooks/useBroadcastBridge.ts`. Subscribes to
  `useAppStore` (Zustand `subscribe`) for changes to
  `(currentScreenId, activeFile)`. Debounce-trailing 50 ms (avoids
  flooding when a single user-action triggers multiple commits) and
  invokes `broadcast_state`.
- Mounted only when broadcasting is active (gated by the store's
  `broadcast.status === 'active'`).
- Project change: when `setProject` runs while broadcasting, emit a
  `bundle-changed` event so connected viewers refetch `/api/bundle`.
  (Or: stop broadcasting on project close — simpler, may be the right
  call for v1; revisit in testing.)

### Phase E — Future, parked

- **Follow mode**: audience can scroll/switch files independently;
  toggle at the top to "snap back to presenter." Adds a per-viewer
  divergence indicator.
- **Cloud relay**: hosted websocket relay so online presenting works.
  Frontend gets a "share online" toggle that pushes the bundle to the
  relay and registers the local server as the source of truth, with
  audience connections coming via the relay.
- **Viewer count + presence**: server counts ws connections,
  broadcasts count back to presenter for the status-bar badge.
- **Audience-driven Q&A**: viewers send "raise hand" / pinned
  questions back to the presenter. Adds a return channel
  (presenter-bound stream).

## Critical files to modify

- `src-tauri/Cargo.toml` — add axum, tokio, rust-embed,
  local-ip-address, nanoid
- `src-tauri/src/lib.rs` — register `BroadcastState`, wire new commands
- `src-tauri/src/commands.rs` — `start_broadcast`, `stop_broadcast`,
  `broadcast_state`; factor the project-root path-escape check into a
  shared helper used by `read_project_file` AND the new bundle endpoint
- `src-tauri/src/broadcast.rs` — new module with axum routes, channel,
  embedded viewer assets
- `src-tauri/capabilities/default.json` — allow new commands
- `tauri.conf.json` — `beforeBuildCommand` runs the viewer build too
- `vite.config.ts` — multi-entry (`index.html`, `viewer.html`)
- `viewer.html` — new entry (root, mounts viewer)
- `src/viewer/main.tsx` — new entry script
- `src/viewer/ViewerShell.tsx` — slim shell, no Tauri
- `src/viewer/useViewerSession.ts` — fetch `/api/bundle`, open WS,
  reconnect on close, dispatch `applyViewerEvent`
- `src/state/store.ts` — `applyViewerEvent`, broadcast slice
  (`{ status, url, sessionId, port }`)
- `src/components/BroadcastControls.tsx` — new status-bar control +
  popover
- `src/components/StatusBar.tsx` — slot the new control in
- `src/hooks/useBroadcastBridge.ts` — new presenter-side subscription
  hook
- `src/App.tsx` — mount the bridge hook when project is loaded
- `package.json` — `build:viewer` script, `qrcode` dependency

## Reused functions / utilities

- `parseDirectives` (`src/project/directiveParser.ts`) — viewer side,
  unchanged
- `buildScreenIndex` / `parseScreenList` (`src/project/stageList.ts`)
  — unchanged
- `computeVisibleFiles` (`src/project/visibleFiles.ts`) — unchanged
- `getHighlighter` / `inferLanguage` (`src/project/shikiSetup.ts`) —
  unchanged
- `reconcileScreenSwitch` (`src/state/stageReducer.ts`) — same logic
  the viewer needs to apply on incoming events
- `useCurrentScreen` / `useVisibleFiles` / `useActiveRenderedFile` /
  `useSymbolTable` (`src/hooks/useRenderedFile.ts`) — pure derivations,
  unchanged
- `commands::read_project_file` path-escape logic
  (`src-tauri/src/commands.rs:187`) — extract into a helper, reuse from
  bundle endpoint

## Verification

- **Phase A — viewer factor**:
  - `pnpm typecheck` clean
  - `pnpm dev:viewer` against a stubbed bundle (load `examples/demo`
    contents from a local JSON) walks all four stages including the
    stepped one; folds, focus highlights, and the explorer behave
    identically to the desktop app
  - Vitest still green (parser + reducer suites unchanged)

- **Phase B — server**:
  - `pnpm tauri dev` then trigger `start_broadcast` from the dev
    console; `curl http://localhost:9876/api/bundle?session=...`
    returns the demo project JSON
  - Open `http://<lan-ip>:9876/s/<session>` in a phone browser on the
    same wifi; SPA loads, shows initial screen
  - WS test: with the viewer open, advance the presenter's screen via
    Space; viewer updates within ~100 ms
  - Project switch: load a different project on the presenter; viewer
    receives `bundle-changed` and refetches
  - Stop broadcast: viewer's WS closes, badge shows "Disconnected"

- **Phase C — UI**:
  - Click broadcast in status bar → popover with QR code, copy link
    works, scanning the QR with a phone opens the viewer
  - Click stop → server actually closes (verified by `netstat`)
  - Restart → reuses last port if free

- **Phase D — bridge**:
  - Every `(screenId, activeFile)` mutation produces exactly one WS
    event (no flooding from `reconcileScreenSwitch` cascades)
  - Late join: open viewer 30 seconds into a presentation; viewer
    lands on the current screen, not the initial one

- **Cross-machine smoke**:
  - Run on a Windows laptop, accept the firewall prompt, audience on a
    second laptop + a phone, walk the demo project from start to
    finish, including a video demo screen (audience should see the
    file the presenter is on while the modal is open — they don't get
    the video, that's expected for v1).

## Open questions / risks

- **Firewall prompt** on first start (Windows). User-visible.
  Document, don't try to suppress.
- **HTTPS-only browser features**. We're serving plain HTTP. WS over
  plain HTTP works fine; no service workers are needed; QR-scan-to-open
  works because Chrome/Safari treat LAN IPs as secure-enough for our
  use. No blockers expected.
- **Project directory traversal**. The bundle endpoint must reuse the
  exact path-escape check that `read_project_file` uses
  (`commands.rs:187`). Don't roll a second one.
- **Bundle size**. Embedding the viewer SPA grows the binary. Shiki is
  the heavy bit (~250 KB). Acceptable.
- **macOS local network permission** (Sonoma+) prompts when binding to
  a LAN port. Same posture as the firewall: document, don't suppress.
- **Mirror vs follow scope**. Committed to mirror for v1. Revisit if we
  learn from real audience feedback that independent scroll/file
  picking matters more than expected.

## Companion idea (parked separately)

A static HTML export of a Prezl project — same Shiki-rendered screens,
same Space/PageDown navigation, but a self-contained zipped folder
anyone can open in a browser. Shares infrastructure with this feature
(both need a Tauri-free viewer that renders any screen from a project
bundle). When we pick up either, we should pick up Phase A from this
plan as the shared foundation.
