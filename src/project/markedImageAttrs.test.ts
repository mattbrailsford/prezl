import { describe, expect, it } from 'vitest'
import { Marked } from 'marked'
import { markedImageAttrs } from './markedImageAttrs'

function render(input: string): string {
  const m = new Marked({ gfm: true, breaks: false })
  m.use(markedImageAttrs)
  return (m.parse(input, { async: false }) as string).trim()
}

describe('markedImageAttrs', () => {
  it('renders a plain image untouched', () => {
    const html = render('![alt](./a.png)')
    expect(html).toContain('<img')
    expect(html).toContain('src="./a.png"')
    expect(html).toContain('alt="alt"')
  })

  it('parses a single class', () => {
    const html = render('![](./a.png){.small}')
    expect(html).toContain('class="small"')
  })

  it('joins multiple classes', () => {
    const html = render('![](./a.png){.small .bordered}')
    expect(html).toContain('class="small bordered"')
  })

  it('parses an id', () => {
    const html = render('![](./a.png){#hero}')
    expect(html).toContain('id="hero"')
  })

  it('parses width and height kv attributes', () => {
    const html = render('![](./a.png){width=200 height=120}')
    expect(html).toContain('width="200"')
    expect(html).toContain('height="120"')
  })

  it('emits width/height as inline style with max-width:none so the global clamp does not shrink them', () => {
    const html = render('![](./a.png){width=400}')
    expect(html).toContain('style="max-width: none; width: 400px"')
  })

  it('appends px to numeric dimensions and keeps explicit units as-is', () => {
    const html = render('![](./a.png){width=50% height=12em}')
    expect(html).toContain('width: 50%')
    expect(html).toContain('height: 12em')
    // Non-numeric width should NOT also emit an HTML width attribute.
    expect(html).not.toContain('width="50%"')
  })

  it('merges author style with synthesised width/height style', () => {
    const html = render('![](./a.png){width=200 style="border: 1px solid red"}')
    expect(html).toMatch(
      /style="max-width: none; width: 200px; border: 1px solid red"/,
    )
  })

  it('handles quoted values with spaces', () => {
    const html = render('![](./a.png){style="float: right; margin: 4px"}')
    expect(html).toContain('style="float: right; margin: 4px"')
  })

  it('keeps the markdown title attribute when both title and attrs present', () => {
    const html = render('![alt](./a.png "Hover text"){.small}')
    expect(html).toContain('title="Hover text"')
    expect(html).toContain('class="small"')
  })

  it('drops event-handler attributes', () => {
    const html = render('![](./a.png){onclick="alert(1)"}')
    expect(html).not.toContain('onclick')
  })

  it('drops unknown bare attributes that aren\'t in the safe list', () => {
    const html = render('![](./a.png){weirdattr}')
    expect(html).not.toContain('weirdattr')
  })

  it('allows data-* and aria-* through', () => {
    const html = render('![](./a.png){data-cue=4 aria-label="diagram"}')
    expect(html).toContain('data-cue="4"')
    expect(html).toContain('aria-label="diagram"')
  })

  it('escapes attribute values to prevent injection', () => {
    const html = render('![](./a.png){style="color:red\\""}')
    expect(html).not.toContain('color:red""')
    expect(html).toContain('&quot;')
  })

  it('falls through to the default image renderer when no braces follow', () => {
    const html = render('![alt](./a.png)\nnext line')
    expect(html).toContain('<img')
    expect(html).not.toContain('class="')
  })

  it('does not consume curly braces on a separate line', () => {
    // Newline between image and `{` should disqualify — keeps prose like
    // "![pic](./p.png)\n\n{notes}" rendering as plain image + paragraph.
    const html = render('![](./p.png)\n\n{notes}')
    expect(html).toContain('<img')
    expect(html).not.toContain('class="notes"')
  })
})
