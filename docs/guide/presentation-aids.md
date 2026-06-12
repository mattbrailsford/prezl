# Presentation aids — cursor highlight & magnifier

Two live tools for the moment you're in front of an audience: a **cursor
highlight** so the back row can follow your pointer, and a **magnifier**
for zooming into a detail — in code *or* in a demo video. Both are
toggled live with the keyboard and tuned in [Settings](#settings).

These are deliberate presenter aids layered *on top* of the deck — they
don't change the code, the screens, or anything you authored. Think of
them as the laser pointer and the document camera, built in.

## Cursor highlight

A soft halo follows your mouse so the audience can track where you're
pointing — dotted outer ring, translucent inner ring, transparent
centre so the code stays readable underneath.

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> | Toggle the cursor highlight on / off |

- **Fades in and out** when you toggle it, and **fades on idle** — stop
  moving for a beat and it dims away, so a stationary cursor doesn't
  nag; the smallest movement brings it back.
- **Pulses on click**, so taps read clearly from a distance.
- **Works over demo videos too** — it sits above the video so you can
  point things out mid-clip.
- **Colour and size** are yours to set — see [Settings](#settings).

::: tip The cursor briefly disappears when I press the shortcut
That's macOS hiding the system arrow while you "type" — it happens on
*any* keyboard shortcut and the arrow returns the instant you move the
mouse. The highlight halo itself stays put; you'll be moving to point at
something anyway, so the arrow is back before it matters.
:::

## Magnifier

An optical zoom that enlarges a region of the screen — like a document
camera pushing in. This is **separate from the font zoom**
(<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>=</kbd>), which reflows text bigger;
the magnifier blows up a region pixel-for-pixel, including a playing
demo video.

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Toggle the magnifier (off ↔ your set level) |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>=</kbd> / <kbd>-</kbd> | Step the zoom level up / down |
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd> / <kbd>Esc</kbd> | Reset to 1× |

- **Zooms where you're pointing** — the spot under the cursor when you
  trigger it stays put as the view scales in.
- **Pan by nudging the edges** — once zoomed, move the cursor toward the
  edge of the screen to glide the magnified region that way. It won't
  scroll past the content into empty space. (The view doesn't chase your
  cursor around — only the edges steer it, so it stays steady while you
  talk.)
- **Eases in and out** so the zoom doesn't jar.
- **Default zoom level** (what the toggle jumps to) is set in
  [Settings](#settings).

> The magnifier is bound to keys Prezl controls on purpose. macOS's own
> three-finger / accessibility zoom collides with the WebView — it can
> pop the video's right-click menu mid-talk — so Prezl ships its own.

## Settings

Both tools are tuned from the **gear icon in the bottom-right of the
status bar**. It opens an IDE-style settings panel with a section list
on the left:

**Cursor highlight**

- Turn the halo on / off (same as the shortcut).
- Pick a **colour** — six presets, or the swatch on the end opens the
  system colour picker for anything else.
- Set the **size** with the slider, with a live preview of the ring.

**Magnifier**

- Set the **toggle zoom level** — what
  <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> jumps to
  (1.5× – 4×). The step shortcuts still range freely from there.

Settings persist across sessions, so your halo colour and zoom level
travel with you from one talk to the next.

See the full list of bindings in the
[keyboard shortcuts reference](../reference/keyboard-shortcuts#presentation-chrome).
