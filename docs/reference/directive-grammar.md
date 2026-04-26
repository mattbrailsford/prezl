# Directive grammar

Formal rules for the `@prezl` comment language. See [Directives](../guide/directives)
for a friendlier introduction.

## Prefix + comment syntax

A directive lives inside a line comment (`//`, `#`, `--`) or a
single-line block comment (`/* … */`, `<!-- … -->`, or Razor's `@* … *@`).
Prezl recognizes either of two prefixes — pick whichever you prefer:

```ts
// @prezl  <attributes>
// @przl   <attributes>
/* @prezl <attributes> */
# @prezl <attributes>          (Python, Ruby, shell, YAML…)
-- @prezl <attributes>         (SQL, Haskell, Lua…)
<!-- @prezl <attributes> -->   (HTML, XML, Vue/Markdown templates…)
@* @prezl <attributes> *@      (Razor / .cshtml — server-side, not rendered)
```

Everything after the prefix is an attribute list, parsed independently
of the surrounding comment syntax.

## Attributes

An attribute is `key=value` or a bare flag `key`. Whitespace-separated.

### Value forms

- `key=[selector]` — a **screen selector** (see below)
- `key="string"` — a double-quoted string
- `key=name` — a bare identifier (used for `id=` and `end=`)

### Screen selector grammar

Selectors describe which **screens** of the deck a directive applies to.
A screen is the addressable unit the presenter advances through —
either a stage with no `steps:` (one implicit screen, id = stage alias)
or a single entry in a stage's `steps:` array (id = `stage.step`).

| Form | Meaning |
| --- | --- |
| `[shell]` | Every screen of the `shell` stage |
| `[shell.intro]` | Exactly one screen |
| `[shell, preview]` | Explicit list — every screen of either stage |
| `[shell.intro, preview.fetch]` | Explicit list of specific screens |
| `[shell...preview]` | Closed range across screen order, inclusive |
| `[shell.intro...shell.outro]` | Closed range within one stage |
| `[shell.intro...preview.fetch]` | Range crossing a stage boundary |
| `[shell...]` | From shell's first screen to end of deck |
| `[...preview]` | From start of deck through preview's last screen |
| `[shell.intro...preview, demo]` | Mix of ranges and explicit items |

In a range, a bare stage alias resolves to that stage's **first** screen
on the left side and **last** screen on the right side, so
`[shell...preview]` Just Works whether either stage has steps or not.

Whitespace inside brackets is ignored. Unknown stage / step aliases and
inverted ranges (`a...b` where `a.order > b.order`) are load-time
errors.

### Known attributes

| Attribute | Value | Where it goes |
| --- | --- | --- |
| `id` | bare identifier | Any opening directive or a single-line anchor |
| `show` | screen selector | Open/close; removes region on non-matching screens |
| `focus` | screen selector | Open/close; highlights region on listed screens |
| `collapse` | bare flag, or screen selector | Open/close; folds region by default |
| `label` | quoted string | Companion to `collapse` — used as the folded placeholder |
| `file` | screen selector | Single-line, must be before any code |
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
current screen, every directive inside its region is dropped before
being evaluated — nested `focus`/`collapse`/`id` never fire. If the
outer region is kept, nested directives apply independently.

## Line-number impact

- `show` regions that don't match the current screen are **removed**
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
- `unknown step alias: <stage>.<step>`
- `inverted range: <a>...<b>`
- `invalid mark name: "<text>"`
- `duplicate id "<name>"` (per-file only; cross-file duplicates are
  silently first-wins)
