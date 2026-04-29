# `prezl://` URL scheme

Reference for the URL grammar used by [slide-deck integration](../guide/slide-deck-integration).
The status-bar share icon builds these for you, but you can also
hand-craft them — useful for scripts, deep links inside web docs, or
templating across many decks.

## Grammar

```
prezl://open?path=<urlencoded-absolute-path>
            [&screen=<id>]
            [&fullscreen=1]
            [&hideOnExit=1]
```

Only one action is defined today (`open`). The path is the only
required parameter.

## Parameters

| Param | Required | Value | Effect |
| --- | --- | --- | --- |
| `path` | yes | URL-encoded absolute folder path | The Prezl project folder to open. Must contain `prezl.yaml`. |
| `screen` | no | Stage id or `<stage>.<step>` | Switches to this screen after the project loads. Unknown ids are ignored (project still opens). |
| `fullscreen` | no | `1` | Enters fullscreen on launch. |
| `hideOnExit` | no | `1` | Surfaces the "Back to presentation" button + <kbd>Shift</kbd>+<kbd>Esc</kbd> binding inside Prezl. |

Any other query parameters are ignored. Flags use the literal value
`1`; absence or any other value is treated as off.

## Encoding

Always URL-encode the `path`. Backslashes, colons, and spaces all need
escaping:

| Raw path | URL-encoded |
| --- | --- |
| `D:\Talks\demo` | `D%3A%5CTalks%5Cdemo` |
| `/Users/me/talks/demo` | `%2FUsers%2Fme%2Ftalks%2Fdemo` |
| `C:\Path With Spaces\proj` | `C%3A%5CPath%20With%20Spaces%5Cproj` |

In JavaScript: `encodeURIComponent(path)`. In PowerShell:
`[System.Web.HttpUtility]::UrlEncode($path)`.

## Examples

Open a project:

```
prezl://open?path=D%3A%5CTalks%5Cdemo
```

Open at a specific stage, fullscreen, with the "Back" button:

```
prezl://open?path=D%3A%5CTalks%5Cdemo&screen=preview&fullscreen=1&hideOnExit=1
```

Open at a specific *step* within a stepped stage:

```
prezl://open?path=D%3A%5CTalks%5Cdemo&screen=preview.fetchImpl&fullscreen=1
```

## Behaviour

- **Cold start.** If Prezl isn't running, the registered handler
  launches the exe with the URL as `argv[1]`. A boot curtain hides any
  flicker until routing settles.
- **Already running.** A second invocation is collapsed by the
  single-instance plugin: the running window is unminimized + focused,
  and the URL is delivered to it. The current project is replaced if
  `path` differs; the screen is switched without a full reload if it's
  the same project.
- **Invalid `path`.** If the folder doesn't exist or has no
  `prezl.yaml`, Prezl falls back to your most recent project (if any)
  and surfaces a load-error overlay. The deep link doesn't leave the
  app stuck on a black curtain.

## Registering the scheme

The handler has to be registered with the OS before any `prezl://` link
will resolve. See
[Enabling the link handler](../guide/slide-deck-integration#enabling-the-link-handler)
for the user-facing flow. Under the hood:

| OS | What gets written |
| --- | --- |
| Windows | `HKCU\Software\Classes\prezl\shell\open\command` → `"<exe>" "%1"` |
| macOS | `LSSetDefaultHandlerForURLScheme` (runtime) or `Info.plist CFBundleURLTypes` (installed) |
| Linux | `~/.local/share/applications/<app>.desktop` with `MimeType=x-scheme-handler/prezl` |

All three writes are user-scoped — no admin / root required. The
registered command embeds the absolute path of the exe at registration
time.
