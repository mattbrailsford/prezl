# Demo fixture

Four-stage project with one stepped stage. Use it to verify behaviour
after parser/renderer changes — every stage exercises a different
slice of the runtime.

- **`main`** — only `main.ts` + `framework.ts` in the explorer; no
  `open:` declared, so the default "file tree only" state kicks in:
  empty editor pane (faded brand mark + project name) and hidden tab
  strip.
- **`shell`** — `dashboard.ts` appears; `registerDashboard` is the
  focus highlight. The file's own `file=[shell...] focus=[shell]`
  directive also tints the explorer leaf (and its `src/` folder) on
  this stage — exercises the file-level focus path.
- **`preview`** (3 steps — `intro` / `fetchImpl` / `chartHelpers`):
  - `preview.intro` — `dashboard.ts` open at `registerDashboard`,
    focus on `render()`. `Chart rendering helpers` collapsed at the
    bottom.
  - `preview.fetchImpl` — file swaps to `api.ts` via per-step `open`,
    focus on `fetchDashboardData`; `api.ts`'s own
    `file=[preview...] focus=[preview.fetchImpl]` also tints the
    explorer leaf for this one screen. Carries a step-level
    `autoLaunch: 'end'` video demo — forward-advancing from this
    screen plays the wrap-up clip first and then advances to
    `chartHelpers` on the carry-on close (atEnd Space).
  - `preview.chartHelpers` — file back to `dashboard.ts` via per-step
    `open`, scrolls to `renderCharts`. The `Chart rendering helpers`
    fold expands and is focus-highlighted; an inner
    `show=[preview.chartHelpers]` comment block becomes visible. Uses
    `demo: ~` to drop `fetchImpl`'s trailing-video override and
    fall back to the stage default (none here) — exercises the reset
    escape hatch.
- **`demo`** — everything visible, no focus (preview's focus selectors
  don't match this stage's screen).

Switching screens should re-apply folds and never show a flash.
