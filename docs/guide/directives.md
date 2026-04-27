# Directives

Prezl reads simple comments in your source files to decide what's visible,
folded, or highlighted on each screen. We call these **directives**. They
live with the code they describe — rename a function and the marker moves
with it. At render time directives are stripped, so the audience never
sees them.

## The shape

Every directive is a comment whose body starts with `@prezl` (or `@przl`
as a short form):

```ts
// @prezl <attributes>
```

Attributes are space-separated `key=value` or bare flags. Screen
selectors always go in square brackets; labels and other strings go in
double quotes.

The five attributes:

| Attribute | Kind | Purpose |
| --- | --- | --- |
| `id=<name>` | identifier | Mark a named anchor. Referenced from YAML (`open.id`) and from the Ctrl+T symbol finder. |
| `show=[selector]` | range open/close | Region exists on listed screens; **removed** on others (line numbers shift). |
| `focus` or `focus=[selector]` | range open/close | Region is highlighted (always, or on listed screens). |
| `collapse` or `collapse=[selector]` | range open/close | Region is folded by default (always, or on listed screens). Combine with `label="…"`. |
| `file=[selector]` | single-line, top of file | Whole file is visible only on listed screens. |

Close tags:

```ts
// @prezl end         ← closes the most recent open
// @prezl end=foo     ← must match open `id=foo`; mismatch = error
```

## Selectors — stages and steps

A selector identifies which **screens** of the deck a directive applies
to. A screen is either a stage on its own or one entry inside a stage's
`steps:` array. Refs come in two forms:

- **Bare stage alias** — `shell` matches every screen of the shell
  stage (every step inside it).
- **Dotted screen id** — `shell.intro` matches one specific step.

Ranges work flat across the whole deck:

```ts
// @prezl show=[shell.intro...preview.fetch]   ← crosses a stage boundary
// @prezl focus=[preview]                       ← every step of preview
// @prezl collapse=[shell, preview.intro]       ← shell's screens + one preview step
```

See [Stages](./stages) for how steps are declared in `prezl.yaml`, and
the [directive grammar reference](../reference/directive-grammar) for
the full grammar.

## Stacked attributes

Multiple attributes can combine on one open tag — matching range, single
`end`:

```ts
// @prezl id=heavyBits show=[preview...] focus=[preview.intro] collapse label="Internals"
const heavy = wire()
// @prezl end
```

This means: from the first `preview` screen onwards the region exists;
on `preview.intro` specifically it's highlighted; it starts collapsed by
default and renders as a single comment line — `// Internals` at the
block's indent — that the audience can read like pseudo-code; and the
first content line is anchored as `heavyBits` for jumps from YAML or
the symbol finder.

Without a `label`, a collapsed region just appends `⋯` to the start
line and keeps that header visible (e.g. `type Foo = { ⋯`). With a
`label`, the whole block — open line, body, close line — is replaced
by the synthetic comment. The comment prefix follows the file's
language (`//`, `#`, `--`, `<!-- … -->`, etc.), so it reads naturally
in context.

## File-level gate

At the top of a file:

```ts
// @prezl file=[shell...]
```

On screens not in that selector, the file — and any folder that becomes
empty because of it — disappears from the explorer. Use for files that
don't exist yet at earlier stages of the story.

## Marking anchors

Pure-id directives are just named anchors:

```ts
// @prezl id=registerDashboard
export function registerDashboard(app) { … }
```

YAML `open.id: registerDashboard` will scroll to that line regardless of
how many lines get removed above it by other directives. Any usage of the
identifier `registerDashboard` in other visible files becomes a clickable
jump (see [Symbol navigation](./symbol-navigation)).

## Nesting

Directives nest and follow an **outer-wins** rule. If an outer
`show` excludes the current screen, everything inside — including
nested `collapse`/`focus`/`id` — is dropped before being evaluated.

```ts
// @prezl show=[preview...]        ← gate
  // @prezl focus=[shell]           ← never fires on `main` (parent dropped)
  x
  // @prezl end
// @prezl end
```

## Both `@prezl` and `@przl`

Both prefixes are valid. Pick one and be consistent, or mix freely in the
same file — the parser treats them identically.

```ts
// @przl id=compact
// @prezl id=spelled-out
```

## What gets stripped

Every directive comment line (and any line that ends up left blank purely
because of stripping) is removed from the rendered output. The audience
sees clean code. The presenter sees clean code. The disk file is left
untouched.

See the [directive grammar reference](../reference/directive-grammar) for
the formal rules.
