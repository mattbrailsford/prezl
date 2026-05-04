# Multi-project layout

If your talk covers a solution with multiple parts — a .NET backend and a
React frontend, say — declare them as `projects:` in `prezl.yaml`. The
explorer renders each as a distinct, color-coded, collapsible top-level
group.

## Declaring projects

```yaml
projects:
  - name: Backend
    path: src/Backend
    icon: dotnet
  - name: Frontend
    path: src/Frontend
    icon: typescript
  - name: Shared
    path: src/Shared
    color: amber
```

Each entry:

- **`name`** — shown as the group header.
- **`path`** — path (relative to the project root) that this project is
  rooted at. Files inside this path group under this header.
- **`icon`** *(optional)* — hint for the glyph Prezl shows (see below).
- **`color`** *(optional)* — override the auto-derived accent color.

## File routing

Files route to projects by **longest-prefix match** on `path`. Given:

```
src/Backend/Program.cs           → Backend
src/Backend/Api/Weather.cs       → Backend
src/Frontend/App.tsx             → Frontend
README.md                        → (hidden — no matching project)
```

Declaring `projects:` is treated as an **inclusion list**: files that
match no project don't appear in the explorer at all. The reasoning is
that if you've gone to the trouble of enumerating the parts of your
solution, you're orchestrating what the audience sees — a stray
root-level `README.md` or lockfile shouldn't sneak in next to the things
you actually want to talk about.

If you want a flat tree that surfaces every file, omit `projects:`
entirely (the default behaviour).

## Icon → color mapping

`icon:` drives both the glyph on the group header and the default color:

| `icon` value | Glyph | Color |
| --- | --- | --- |
| `dotnet` / `csharp` | `C#` | violet |
| `typescript` / `ts` | `TS` | sky |
| `javascript` / `js` | `JS` | yellow |
| `rust` / `rs` | `Rs` | orange |
| `python` / `py` | `Py` | emerald |
| `go` | `Go` | cyan |
| `java` | (generic) | red |
| `kotlin` / `kt` | (generic) | orange |
| `swift` | (generic) | orange |
| `ruby` / `rb` | (generic) | red |
| `php` | (generic) | indigo |
| `vue` | (generic) | emerald |
| `svelte` | (generic) | orange |
| `html` | (generic) | orange |
| anything else | generic box | Prezl default |

## Explicit color override

Set `color:` on a project to pick a different accent. The valid values
are: `violet`, `sky`, `yellow`, `orange`, `emerald`, `cyan`, `red`,
`indigo`, `pink`, `amber`, `slate`.

```yaml
projects:
  - name: Shared
    path: src/Shared
    icon: dotnet
    color: amber       # still shows the C# glyph, but amber instead of violet
```

## Collapsing groups

Every project header is clickable: click to collapse the whole group.
Groups start expanded. Collapse state is kept alongside folder expand
state in the same session — it doesn't persist across stage changes
(since each stage may show different files).

## When you probably don't need it

For a single-project talk (one language, one folder), skip the
`projects:` key entirely. The explorer renders a plain flat tree, same
as Prezl's default behavior. Add `projects:` only when the solution
actually has multiple logical parts worth showing distinctly.
