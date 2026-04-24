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
- **`path`** — path under `files/` that this project rooted at. Files
  inside this path group under this header.
- **`icon`** *(optional)* — hint for the glyph Prezl shows (see below).
- **`color`** *(optional)* — override the auto-derived accent color.

## File routing

Files route to projects by **longest-prefix match** on `path`. Given:

```
files/src/Backend/Program.cs           → Backend
files/src/Backend/Api/Weather.cs       → Backend
files/src/Frontend/App.tsx             → Frontend
files/README.md                        → Files (catch-all)
```

Files matching no declared project go into a synthetic `Files` group at
the bottom.

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

Every project header (and the catch-all `Files` header) is clickable:
click to collapse the whole group. Groups start expanded. Collapse state
is kept alongside folder expand state in the same session — it doesn't
persist across stage changes (since each stage may show different files).

## When you probably don't need it

For a single-project talk (one language, one folder), skip the
`projects:` key entirely. The explorer renders a plain flat tree, same
as Prezl's default behavior. Add `projects:` only when the solution
actually has multiple logical parts worth showing distinctly.
