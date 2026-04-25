# Launching Prezl from a slide deck

The most awkward moment in a "live coding" talk is the hand-off: you're
on a slide, you alt-tab to your editor, you hunt for the right window,
the audience watches you fumble. Prezl can be launched from a hyperlink
in your slide deck instead — click the link, Prezl opens at exactly the
screen you want, in fullscreen, ready to present. When you're done with
the code section, one button hands focus back to the deck.

This page covers how to set it up. The full URL grammar lives in the
[`prezl://` URL scheme reference](../reference/url-scheme).

## At a glance

1. Open the project you want to link to in Prezl.
2. In the status bar (bottom-right), enable the `prezl://` handler — see
   [Enabling the link handler](#enabling-the-link-handler).
3. Click the share icon to copy a link to the current screen, or
   alt-click / right-click for options including a saveable shortcut
   file.
4. Paste the link as a hyperlink in your slide tool. Click it during
   the talk to launch Prezl.
5. Click the slideshow icon (top-right of Prezl) — or press
   <kbd>Shift</kbd>+<kbd>Esc</kbd> — to hand focus back to your deck.

## Enabling the link handler

For Windows the `prezl://` URL scheme has to be registered with the OS
before slide-deck links work. The registration writes a single key under
`HKCU\Software\Classes\prezl` — per-user, no admin prompt, no UAC. macOS
and Linux equivalents work the same way through their respective
mechanisms.

**Installed builds** register automatically during install — nothing to
do.

**Portable builds** ship without touching the registry by design, so the
status bar shows a small toggle icon that lets you opt in. Click it once
to register; the icon flips to a check, and the link handler points at
the currently-running exe.

**Dev builds** are treated like portable: the toggle is visible whenever
the protocol isn't registered, so you can flip it on for local testing.

::: tip Re-registering after moving a portable exe
The registered command embeds the absolute path of the exe at the
moment you register. If you move the portable exe to another folder,
the link points at the old path and silently fails. Click the toggle
once after moving — the registration self-heals against the new path.
:::

## Copying a link

The share icon next to the toggle is the primary action.

- **Click** — copies a link to the *current screen* with sensible
  defaults (`fullscreen=1`, `hideOnExit=1`). A short toast confirms.
- **Alt-click or right-click** — opens an options popover. Pick a
  different target (whole project, current screen, or any specific
  screen by alias), toggle fullscreen / hide-on-exit, then **Copy link**.

If you click the share icon while the protocol isn't registered, the
copy is refused — you'd just be putting a non-functional URL on the
clipboard. The toast tells you to enable links first.

## Saving a shortcut file

The popover also has a **Save shortcut** button that writes a
clickable shortcut file containing the URL. Useful when your slide
tool doesn't honour custom URL schemes — see [tool-specific
notes](#tool-specific-notes) below. The format follows the host OS:

| OS | Extension | Format |
| --- | --- | --- |
| Windows | `.url` | Internet Shortcut (INI-like) |
| macOS | `.webloc` | Apple property list (XML) |
| Linux | `.desktop` | Desktop entry |

Drop the resulting file next to your deck and hyperlink the slide to
*the file*, not the URL. Double-clicking the file resolves through the
registered handler and launches Prezl.

## Tool-specific notes

### PowerPoint

- **In slideshow mode (F5)**, hyperlinks use `ShellExecute` and custom
  schemes work fine. Paste the `prezl://` URL directly into Insert →
  Hyperlink → Address.
- **In edit mode**, clicked hyperlinks sometimes route through the
  default browser instead. If you're testing without entering
  slideshow, use a `.url` shortcut file instead.

### Keynote (macOS)

`prezl://` URLs work directly in slideshow mode. Insert → Add Link →
Webpage, paste the URL. The `.webloc` workaround is rarely needed.

### WPS Office

WPS funnels every hyperlink through its own browser launcher rather
than the OS handler, so a raw `prezl://` URL always opens in your
browser instead of Prezl. Use a **`.url` shortcut file** instead:
hyperlink the slide to the file, not the URL. Same trick on macOS WPS
with `.webloc`.

### Google Slides / browser-based decks

Browsers will surface a one-time *"This site is trying to open
prezl://"* prompt the first time you click. Allow it, and subsequent
clicks launch Prezl directly.

## Back to the slide deck

When the deep-link sets `hideOnExit=1` (the default for the share-icon
copy), Prezl shows a small slideshow icon in the top bar next to the
Run button. Click it — or press <kbd>Shift</kbd>+<kbd>Esc</kbd> — to
hand focus back.

Behaviour is platform-aware:

- **Windows / Linux** — minimizes Prezl. The slideshow window behind
  it gets focus from the OS Z-order, so you can advance immediately
  with the same remote.
- **macOS** — hides the Prezl app via `NSApp hide:`. This jumps back
  to the previous Space, which matters if Keynote is in fullscreen
  presenter mode on its own Space.

The button only appears when Prezl was launched with `hideOnExit=1`,
so manually-opened projects don't show it.

## Removing the handler

In portable mode, click the registered toggle (the check icon)
again. The HKCU key is deleted; clicking any `prezl://` link will
behave as if Prezl were never installed. You can re-register at any
time.

For installed builds, uninstall removes the registration along with
everything else.
