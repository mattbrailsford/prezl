import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'dark',
  themeVariables: {
    background: 'transparent',
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
})

let renderCounter = 0

/** Render a mermaid source string to an SVG fragment. Returns the SVG markup
 *  on success, `null` on parse/render failure (caller leaves the original
 *  code block in place). The id is unique per call so concurrent renders
 *  don't clash on mermaid's internal DOM scratch element. */
export async function renderMermaid(source: string): Promise<string | null> {
  try {
    const id = `prezl-mermaid-${++renderCounter}`
    const { svg } = await mermaid.render(id, source)
    return svg
  } catch {
    return null
  }
}
