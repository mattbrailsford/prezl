# Directive grammar

Formal rules for the `@prezl:*` comment language. See [Directives](../guide/directives)
for a friendlier introduction.

## Prefix + comment syntax

A directive lives inside a line comment (`//`, `#`, `--`) or a
single-line block comment (`/* … */`). Prezl recognizes either of two
prefixes — pick whichever you prefer:

```ts
// @prezl  <attributes>
// @przl   <attributes>
/* @prezl <attributes> */
# @prezl <attributes>          (Python, Ruby, shell, YAML…)
-- @prezl <attributes>         (SQL, Haskell, Lua…)
```

Everything after the prefix is an attribute list, parsed independently
of the surrounding comment syntax.

## Attributes

An attribute is `key=value` or a bare flag `key`. Whitespace-separated.

### Value forms

- `key=[stages]` — a **stage list** (see below)
- `key="string"` — a double-quoted string
- `key=name` — a bare identifier (used for `id=` and `end=`)

### Stage-list grammar

- `[shell]` — exactly one stage
- `[shell, preview]` — explicit list
- `[shell...preview]` — closed range, resolved by branch `order`
- `[shell...]` — from shell onwards
- `[...preview]` — up to and including preview
- `[shell...preview, demo]` — mix ranges and explicit items

Whitespace inside brackets is ignored. Unknown aliases and inverted
ranges (`a...b` where `a.order > b.order`) are load-time errors.

### Known attributes

| Attribute | Value | Where it goes |
| --- | --- | --- |
| `id` | bare identifier | Any opening directive or a single-line anchor |
| `show` | stage list | Open/close; removes region on non-matching stages |
| `focus` | stage list | Open/close; highlights region on listed stages |
| `collapse` | bare flag, or stage list | Open/close; folds region by default |
| `label` | quoted string | Companion to `collapse` — used as the folded placeholder |
| `file` | stage list | Single-line, must be before any code |
| `end` | bare flag, or bare id | Close tag |

## Directive kinds

The parser classifies an attribute set into one of:

1. **`file`** — `file=[…]` with no other attributes. Single-line;
   must appear before any non-blank, non-comment line.
2. **`end`** — has an `end` key. Pops the top of the directive stack.
   Optionally `end=id` for name-matched closing.
3. **Anchor** — only an `id=`, no `show`/`focus`/`collapse`. Names the
   next emitted line.
4. **Region open** — has at least one of `show`, `focus`, `collapse`,
   optionally `id`, optionally `label` (with `collapse`). Region
   continues until a matching `end`.
5. **Invalid** — anything else (empty directive, `label` without
   `collapse`, unknown attributes). Surfaced as a load-time error in
   the app's error overlay.

## Nesting semantics — "outer wins"

Directives nest freely. If an outer `show` (or `file`) excludes the
current stage, every directive inside its region is dropped before
being evaluated — nested `focus`/`collapse`/`id` never fire. If the
outer region is kept, nested directives apply independently.

## Line-number impact

- `show` regions that don't match the current stage are **removed**
  from the rendered text, shifting later line numbers up.
- `collapse` and `focus` never change line numbers — they just record
  ranges for the editor to fold or decorate.
- `id` / `mark` resolve to the line number in the **rendered** text, so
  a YAML `open.id: …` scroll target is correct regardless of what got
  removed above it.

## Errors surfaced to the author

The load overlay lists each error with a file path and line:

- `@prezl file=[...] must appear before any code`
- `@prezl end with no matching open`
- `@prezl end=<id> does not match open id=<other>`
- `@prezl open [id=x] was never closed`
- `unknown stage alias: <alias>`
- `inverted range: <a>...<b>`
- `invalid mark name: "<text>"`
- `duplicate id "<name>"` (per-file only; cross-file duplicates are
  silently first-wins)
