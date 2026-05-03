import type { MarkedExtension, TokenizerAndRendererExtension } from 'marked'

/** Pandoc / `markdown-it-attrs`-style image attributes for `marked`.
 *
 *  Matches `![alt](src){...}` (with optional title in quotes between the
 *  src and the closing paren) and parses the curly block into class /
 *  id / kv attributes:
 *
 *    ![Diagram](./d.png){.small width=200}
 *    ![Logo](/logo.svg){#brand-mark style="float: right" loading=lazy}
 *    ![Step](step.png){.bordered title="hover text"}
 *
 *  Recognised tokens inside the braces:
 *    .name           → adds `name` to the class list
 *    #name           → sets the id
 *    key=value       → arbitrary attribute (value may be unquoted, single,
 *                      or double-quoted; whitespace inside quotes is fine)
 *    key             → boolean attribute (renders as `key=""` or omitted —
 *                      we render it as `key` only when on a known boolean
 *                      attribute, otherwise `key=""` for compatibility)
 *
 *  Attribute names are filtered to a safe-list — anything starting with
 *  `on` (event handlers) is dropped, and only known image-relevant keys
 *  + `data-*` / `aria-*` get through. Attribute values are HTML-escaped
 *  before render. The image's `src` itself is left to the rest of the
 *  pipeline to rewrite (the `<img>` post-process pass in MarkdownView). */
export const markedImageAttrs: MarkedExtension = {
  extensions: [imageAttrsExtension()],
}

type ParsedAttrs = {
  class?: string
  id?: string
  others: Array<[string, string | true]>
}

function imageAttrsExtension(): TokenizerAndRendererExtension {
  return {
    name: 'imageAttrs',
    level: 'inline',
    start(src) {
      // Cheap probe to point marked at candidate offsets; the real check
      // happens in tokenizer().
      return src.indexOf('![')
    },
    tokenizer(src) {
      const match = IMAGE_ATTRS_RE.exec(src)
      if (!match) return undefined
      const [raw, alt, hrefPart, titlePart, attrBody] = match
      const { href, title } = splitHrefAndTitle(hrefPart, titlePart)
      const attrs = parseAttrBlock(attrBody)
      return {
        type: 'imageAttrs',
        raw,
        text: alt ?? '',
        href,
        title: title ?? null,
        attrs,
      }
    },
    renderer(token) {
      const t = token as unknown as {
        text: string
        href: string
        title: string | null
        attrs: ParsedAttrs
      }
      const parts: string[] = ['<img']
      pushAttr(parts, 'src', t.href)
      pushAttr(parts, 'alt', t.text)
      if (t.title) pushAttr(parts, 'title', t.title)
      if (t.attrs.id) pushAttr(parts, 'id', t.attrs.id)
      if (t.attrs.class) pushAttr(parts, 'class', t.attrs.class)

      // Width/height get rendered as both the HTML attribute (so the
      // browser reserves the box before the image loads — no CLS) AND as
      // inline style with `max-width: none` prepended, so the author's
      // dimension wins over the global `.prezl-md img { max-width: 100% }`
      // safety-clamp. Without that prefix, `width=400` inside a 300px-wide
      // panel would silently shrink to 300, which reads as the attribute
      // being ignored.
      const inlineStyle: string[] = []
      let authorStyle = ''
      const otherAttrs: Array<[string, string | true]> = []
      for (const [k, v] of t.attrs.others) {
        if (k === 'width' || k === 'height') {
          if (v === true) continue
          const cssValue = /^\d+$/.test(v) ? `${v}px` : v
          inlineStyle.push(`${k}: ${cssValue}`)
          if (/^\d+$/.test(v)) pushAttr(parts, k, v)
        } else if (k === 'style') {
          authorStyle = v === true ? '' : v
        } else {
          otherAttrs.push([k, v])
        }
      }
      if (inlineStyle.length > 0) {
        inlineStyle.unshift('max-width: none')
      }
      const mergedStyle = [
        inlineStyle.join('; '),
        authorStyle.replace(/;\s*$/, ''),
      ]
        .filter((s) => s.length > 0)
        .join('; ')
      if (mergedStyle) pushAttr(parts, 'style', mergedStyle)

      for (const [k, v] of otherAttrs) {
        if (v === true) {
          parts.push(' ', escapeAttr(k))
        } else {
          pushAttr(parts, k, v)
        }
      }
      parts.push(' />')
      return parts.join('')
    },
  }
}

// `![alt](href[ "title"])` followed (no newline) by `{...}`. Greedy `]` /
// `)` matching is bounded by the absence of those characters in the
// label — same as marked's own image regex, just without nesting because
// we don't need it for the attribute extension.
const IMAGE_ATTRS_RE =
  /^!\[((?:\\[\\\]]|[^\]\n])*)\]\(\s*((?:\\[\s\S]|[^()\s])+?(?:\([^)]*\)[^()\s]*)?)(?:\s+("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'))?\s*\)\s*\{([^}\n]+)\}/

function splitHrefAndTitle(
  hrefPart: string,
  titlePart: string | undefined,
): { href: string; title: string | null } {
  const href = hrefPart.trim()
  if (!titlePart) return { href, title: null }
  const inner = titlePart.slice(1, -1)
  return { href, title: inner }
}

function parseAttrBlock(body: string): ParsedAttrs {
  const out: ParsedAttrs = { others: [] }
  const classes: string[] = []
  const tokens = tokeniseAttrs(body.trim())
  for (const tok of tokens) {
    if (tok.startsWith('.')) {
      const name = tok.slice(1)
      if (isSafeClassOrId(name)) classes.push(name)
      continue
    }
    if (tok.startsWith('#')) {
      const id = tok.slice(1)
      if (isSafeClassOrId(id)) out.id = id
      continue
    }
    const eq = tok.indexOf('=')
    if (eq === -1) {
      // Bare attribute. Treat as boolean.
      if (isSafeAttrName(tok)) out.others.push([tok, true])
      continue
    }
    const name = tok.slice(0, eq).trim()
    const rawValue = tok.slice(eq + 1).trim()
    if (!isSafeAttrName(name)) continue
    out.others.push([name, unquote(rawValue)])
  }
  if (classes.length) out.class = classes.join(' ')
  return out
}

/** Split an attribute body into individual tokens, respecting quoted
 *  values so `key="a b c"` stays one token. */
function tokeniseAttrs(body: string): string[] {
  const out: string[] = []
  let buf = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quote) {
      buf += c
      if (c === quote && body[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'") {
      buf += c
      quote = c
      continue
    }
    if (/\s/.test(c)) {
      if (buf) {
        out.push(buf)
        buf = ''
      }
      continue
    }
    buf += c
  }
  if (buf) out.push(buf)
  return out
}

function unquote(s: string): string {
  if (s.length >= 2) {
    const first = s[0]
    const last = s[s.length - 1]
    if ((first === '"' || first === "'") && last === first) {
      return s.slice(1, -1).replace(/\\(.)/g, '$1')
    }
  }
  return s
}

const SAFE_NAME_RE = /^[A-Za-z][\w-]*$/

function isSafeClassOrId(name: string): boolean {
  return SAFE_NAME_RE.test(name)
}

const SAFE_ATTRS = new Set([
  'class',
  'id',
  'width',
  'height',
  'style',
  'align',
  'loading',
  'decoding',
  'fetchpriority',
  'referrerpolicy',
  'crossorigin',
  'sizes',
  'srcset',
  'title',
])

function isSafeAttrName(name: string): boolean {
  if (!SAFE_NAME_RE.test(name)) return false
  const lower = name.toLowerCase()
  if (lower.startsWith('on')) return false // event handlers — never
  if (lower.startsWith('data-')) return true
  if (lower.startsWith('aria-')) return true
  return SAFE_ATTRS.has(lower)
}

function pushAttr(parts: string[], name: string, value: string) {
  parts.push(' ', name, '="', escapeAttr(value), '"')
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
