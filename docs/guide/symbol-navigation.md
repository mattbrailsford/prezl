# Symbol navigation

Prezl's symbol navigation uses the same `@prezl id=<name>` anchors you
already use for stage scroll targets. No YAML `symbols:` section, no
language server, no project-wide index — just pick names you care about
and mark them where they're defined.

## Marking a symbol

```ts
// @prezl id=registerDashboard
export function registerDashboard(app) { … }
```

That creates a project-wide anchor named `registerDashboard` pointing at
the first content line of the region (the function signature in this
case).

Any directive that already has other attributes can also carry an `id`:

```ts
// @prezl id=heavyBits show=[preview...] focus=[preview] collapse label="Internals"
```

## What happens next

Two things automatically become interactive wherever the identifier
`registerDashboard` appears in visible files:

1. **Click to jump.** The identifier is rendered with a dotted underline.
   Clicking it opens the file containing the definition and scrolls to
   the marked line — even if that file isn't already open in a tab.
2. **Ctrl+T finder.** Press <kbd>Ctrl</kbd>+<kbd>T</kbd> to open a fuzzy
   search over every id in the project (at the current stage). Type
   `regD` → `registerDashboard` ranks first. Arrow keys cycle, Enter
   jumps.

The definition site itself is **not** turned into a link (clicking the
function name where it's defined would jump in place — pointless). Only
usage sites become jumps.

## On landing

A jump does two things to help the audience follow you:

- **Auto-expand collapsed folds.** If the target line sits inside a
  collapsed `@prezl collapse` region — or *is* the fold's header line,
  as when an id sits on a `collapse`d type declaration — the fold
  opens automatically so the body is visible. You can re-collapse it
  manually with the gutter toggle; advancing to the next screen
  re-applies the directive defaults.
- **Highlight flash.** The landed line briefly pulses with the accent
  colour and fades out (~1.6s). It only fires for explicit jumps
  (symbol click, Ctrl+T) — not for the automatic scroll that happens
  on every screen advance.

## Picking good ids

Prezl matches identifiers by exact word boundary, case-sensitive. That's
usually enough to keep things unambiguous, but the rule of thumb is:

- Use real function / type / component names: `registerDashboard`,
  `WeatherController`, `fetchForecast`.
- Avoid generic names that also appear as local variables: `config`,
  `data`, `x`, `handler`.
- Stage-prefix if collisions happen: `shellRegisterDashboard`.

If two marks share the same id, the first one encountered in the
explorer's file-order wins. The parser doesn't error on collisions — it
just picks one — so distinctiveness is an authoring responsibility.

## Cross-project jumps

Symbols work across declared `projects:` (e.g. a Backend function
called from a Frontend file). Mark the definition once; every visible
call site becomes clickable regardless of which project it lives in.
