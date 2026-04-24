# Directives

Prezl reads simple comments in your source files to decide what's visible,
folded, or highlighted on each stage. We call these **directives**. They
live with the code they describe — rename a function and the marker moves
with it. At render time directives are stripped, so the audience never
sees them.

## The shape

Every directive is a comment whose body starts with `@prezl` (or `@przl`
as a short form):

```ts
// @prezl <attributes>
```

Attributes are space-separated `key=value` or bare flags. Stage lists
always go in square brackets; labels and other strings go in double quotes.

The five attributes:

| Attribute | Kind | Purpose |
| --- | --- | --- |
| `id=<name>` | identifier | Mark a named anchor. Referenced from YAML (`open.id`) and from the Ctrl+T symbol finder. |
| `show=[stages]` | range open/close | Region exists on listed stages; **removed** on others (line numbers shift). |
| `focus=[stages]` | range open/close | Region is highlighted on listed stages. |
| `collapse` or `collapse=[stages]` | range open/close | Region is Monaco-folded by default (always, or on listed stages). Combine with `label="…"`. |
| `file=[stages]` | single-line, top of file | Whole file is visible only on listed stages. |

Close tags:

```ts
// @prezl end         ← closes the most recent open
// @prezl end=foo     ← must match open `id=foo`; mismatch = error
```

## Stacked attributes

Multiple attributes can combine on one open tag — matching range, single
`end`:

```ts
// @prezl id=heavyBits show=[preview...] focus=[preview] collapse label="Internals"
const heavy = wire()
// @prezl end
```

This means: on `preview` onwards, the region exists; on `preview` it's
highlighted; it starts collapsed by default with the label
`▶ Internals`; and the first content line is anchored as `heavyBits` for
jumps from YAML or the symbol finder.

## File-level gate

At the top of a file:

```ts
// @prezl file=[shell...]
```

On stages not in that list, the file — and any folder that becomes empty
because of it — disappears from the explorer. Use for files that don't
exist yet at earlier stages of the story.

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
`@prezl:show` excludes the current stage, everything inside — including
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
