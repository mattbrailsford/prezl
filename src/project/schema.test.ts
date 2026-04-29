import { describe, expect, it } from 'vitest'
import { prezlProjectSchema, resolvePreviewField } from './schema'

function parsePreview(autoLaunch: unknown) {
  // Use the singular `preview:` shorthand; resolvePreviewField is what the
  // loader uses to normalise both shapes into a single list.
  const result = prezlProjectSchema.safeParse({
    name: 'Test',
    stages: [
      {
        alias: 'shell',
        preview: { type: 'video', src: './v.mp4', autoLaunch },
      },
    ],
  })
  if (!result.success) return { ok: false as const, issues: result.error.issues }
  const list = resolvePreviewField(result.data.stages[0])
  const preview = list?.[0]
  return { ok: true as const, preview }
}

describe('schema — video autoLaunch normalisation', () => {
  it('accepts the literal "start"', () => {
    const r = parsePreview('start')
    expect(r.ok).toBe(true)
    if (r.ok && r.preview?.type === 'video') {
      expect(r.preview.autoLaunch).toBe('start')
    }
  })

  it('accepts the literal "end"', () => {
    const r = parsePreview('end')
    expect(r.ok).toBe(true)
    if (r.ok && r.preview?.type === 'video') {
      expect(r.preview.autoLaunch).toBe('end')
    }
  })

  it('normalises true → "start" (boolean shorthand)', () => {
    const r = parsePreview(true)
    expect(r.ok).toBe(true)
    if (r.ok && r.preview?.type === 'video') {
      expect(r.preview.autoLaunch).toBe('start')
    }
  })

  it('normalises false → undefined (no autolaunch)', () => {
    const r = parsePreview(false)
    expect(r.ok).toBe(true)
    if (r.ok && r.preview?.type === 'video') {
      expect(r.preview.autoLaunch).toBeUndefined()
    }
  })

  it('rejects unknown strings', () => {
    const r = parsePreview('middle')
    expect(r.ok).toBe(false)
  })
})

describe('schema — preview list shape', () => {
  it('wraps a single `preview:` object in a one-element list (after loader normalisation)', () => {
    const r = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          preview: { type: 'url', src: 'https://example.com' },
        },
      ],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      const list = resolvePreviewField(r.data.stages[0])
      expect(list).toHaveLength(1)
      expect(list?.[0]).toEqual({
        type: 'url',
        src: 'https://example.com',
      })
    }
  })

  it('accepts an explicit `previews:` list', () => {
    const r = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          previews: [
            { type: 'url', src: 'https://example.com' },
            { type: 'video', src: './v.mp4' },
          ],
        },
      ],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.stages[0].previews).toHaveLength(2)
    }
  })

  it('rejects both `preview:` and `previews:` on the same stage', () => {
    const r = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          preview: { type: 'url', src: 'https://example.com' },
          previews: [{ type: 'video', src: './v.mp4' }],
        },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('rejects two entries with autoLaunch: start', () => {
    const r = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          previews: [
            { type: 'video', src: 'a.mp4', autoLaunch: 'start' },
            { type: 'video', src: 'b.mp4', autoLaunch: 'start' },
          ],
        },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('rejects two entries with autoLaunch: end', () => {
    const r = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          previews: [
            { type: 'video', src: 'a.mp4', autoLaunch: 'end' },
            { type: 'video', src: 'b.mp4', autoLaunch: 'end' },
          ],
        },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('accepts one start + one end', () => {
    const r = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          previews: [
            { type: 'video', src: 'a.mp4', autoLaunch: 'start' },
            { type: 'video', src: 'b.mp4', autoLaunch: 'end' },
            { type: 'url', src: 'https://example.com' },
          ],
        },
      ],
    })
    expect(r.success).toBe(true)
  })
})

describe('schema — step preview/open reset (null)', () => {
  function parseStep(stepFields: Record<string, unknown>) {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          steps: [{ alias: 'a' }, { alias: 'b', ...stepFields }],
        },
      ],
    })
    if (!result.success) return { ok: false as const, issues: result.error.issues }
    // After parsing, the string-shorthand step variant has been transformed
    // to its object form, so every step has the wider object shape — but the
    // schema's union return type doesn't reflect that. Cast for ergonomic
    // field access in these assertions.
    type ObjectStep = {
      preview?: unknown
      previews?: unknown
      open?: unknown
    }
    const step = result.data.stages[0].steps?.[1] as ObjectStep | undefined
    return { ok: true as const, step }
  }

  it('accepts preview: null on a step (singular shorthand normalises to null list)', () => {
    const r = parseStep({ preview: null })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.step?.preview).toBeNull()
      // resolvePreviewField returns null for explicit clear.
      expect(
        resolvePreviewField(
          (r.step ?? {}) as Parameters<typeof resolvePreviewField>[0],
        ),
      ).toBeNull()
    }
  })

  it('accepts previews: null on a step (plural form)', () => {
    const r = parseStep({ previews: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.step?.previews).toBeNull()
  })

  it('accepts open: null on a step', () => {
    const r = parseStep({ open: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.step?.open).toBeNull()
  })

  it('keeps previews undefined when omitted (falls back to stage default at resolve time)', () => {
    const r = parseStep({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.step?.preview).toBeUndefined()
      expect(r.step?.previews).toBeUndefined()
      expect(r.step?.open).toBeUndefined()
    }
  })
})

describe('schema — open string shorthand', () => {
  function parseStageOpen(open: unknown) {
    const r = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [{ alias: 'shell', open }],
    })
    if (!r.success) return { ok: false as const, issues: r.error.issues }
    return { ok: true as const, open: r.data.stages[0].open }
  }

  it('bare path stays a path', () => {
    const r = parseStageOpen('src/api.ts')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.open).toEqual({ file: 'src/api.ts' })
  })

  it('peels #id suffix', () => {
    const r = parseStageOpen('src/api.ts#fetchData')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.open).toEqual({ file: 'src/api.ts', id: 'fetchData' })
  })

  it('peels @line suffix', () => {
    const r = parseStageOpen('src/api.ts@42')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.open).toEqual({ file: 'src/api.ts', line: 42 })
  })

  it('peels #id@line in either order', () => {
    const a = parseStageOpen('src/api.ts#fetchData@42')
    const b = parseStageOpen('src/api.ts@42#fetchData')
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    if (a.ok && b.ok) {
      const expected = { file: 'src/api.ts', id: 'fetchData', line: 42 }
      expect(a.open).toEqual(expected)
      expect(b.open).toEqual(expected)
    }
  })

  it('leaves @ in npm-scoped paths intact (suffix not all digits)', () => {
    const r = parseStageOpen('node_modules/@types/foo.ts')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.open).toEqual({ file: 'node_modules/@types/foo.ts' })
  })

  it('leaves @line at the end intact when path also has scoped @', () => {
    const r = parseStageOpen('node_modules/@types/foo.ts@42')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.open).toEqual({ file: 'node_modules/@types/foo.ts', line: 42 })
    }
  })

  it('rejects @0 (line must be positive)', () => {
    // @0 isn't a valid line — the suffix doesn't peel, and the whole
    // string survives as the file path.
    const r = parseStageOpen('src/api.ts@0')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.open).toEqual({ file: 'src/api.ts@0' })
  })

  it('rejects @<non-digit> (treated as part of the path)', () => {
    const r = parseStageOpen('src/api.ts@head')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.open).toEqual({ file: 'src/api.ts@head' })
  })
})

describe('schema — cover string shorthand', () => {
  function parseStageCover(items: unknown[]) {
    const r = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [{ alias: 'shell', cover: items }],
    })
    if (!r.success) return { ok: false as const, issues: r.error.issues }
    return { ok: true as const, cover: r.data.stages[0].cover }
  }

  it('peels #id and @line on cover items just like open', () => {
    const r = parseStageCover([
      'src/api.ts',
      'src/api.ts#fetchData',
      'src/api.ts@42',
      'src/api.ts#fetchData@42',
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.cover).toEqual([
        { file: 'src/api.ts' },
        { file: 'src/api.ts', id: 'fetchData' },
        { file: 'src/api.ts', line: 42 },
        { file: 'src/api.ts', id: 'fetchData', line: 42 },
      ])
    }
  })
})

describe('schema — partial open object', () => {
  function parseStepOpen(open: unknown) {
    return prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          steps: [{ alias: 'a', open: { file: 'a.ts' } }, { alias: 'b', open }],
        },
      ],
    })
  }

  it('accepts an open object with only an id (file inherited at resolve time)', () => {
    const r = parseStepOpen({ id: 'foo' })
    expect(r.success).toBe(true)
  })

  it('accepts an open object with only a line', () => {
    const r = parseStepOpen({ line: 42 })
    expect(r.success).toBe(true)
  })

  it('rejects an empty open object', () => {
    const r = parseStepOpen({})
    expect(r.success).toBe(false)
  })
})

describe('schema — stage open: null', () => {
  it('accepts open: null on a stage (no file open)', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [{ alias: 'intro', open: null }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stages[0].open).toBeNull()
    }
  })

  it('keeps stage open undefined when omitted', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [{ alias: 'shell' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stages[0].open).toBeUndefined()
    }
  })
})

describe('schema — cover list', () => {
  it('accepts a list of bare path strings as shorthand', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          cover: ['src/dashboard.ts', 'src/api.ts'],
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stages[0].cover).toEqual([
        { file: 'src/dashboard.ts' },
        { file: 'src/api.ts' },
      ])
    }
  })

  it('parses path#id shorthand into file + id', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        { alias: 'shell', cover: ['src/dashboard.ts#registerDashboard'] },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stages[0].cover).toEqual([
        { file: 'src/dashboard.ts', id: 'registerDashboard' },
      ])
    }
  })

  it('accepts the full object form with label', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          cover: [
            { file: 'src/api.ts', id: 'fetchData', label: 'Data fetching' },
          ],
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stages[0].cover?.[0]).toEqual({
        file: 'src/api.ts',
        id: 'fetchData',
        label: 'Data fetching',
      })
    }
  })

  it('accepts cover: null on a step (reset to stage default)', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [
        {
          alias: 'shell',
          cover: ['a.ts'],
          steps: [{ alias: 'one' }, { alias: 'two', cover: null }],
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const step = result.data.stages[0].steps?.[1] as { cover?: unknown }
      expect(step?.cover).toBeNull()
    }
  })

  it('rejects an empty cover item path', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [{ alias: 'shell', cover: [''] }],
    })
    expect(result.success).toBe(false)
  })
})

describe('schema — stage reset flag', () => {
  it('accepts reset: true on a stage', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [{ alias: 'shell', reset: true }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stages[0].reset).toBe(true)
    }
  })

  it('keeps reset undefined when omitted', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [{ alias: 'shell' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stages[0].reset).toBeUndefined()
    }
  })

  it('rejects non-boolean reset', () => {
    const result = prezlProjectSchema.safeParse({
      name: 'Test',
      stages: [{ alias: 'shell', reset: 'yes' }],
    })
    expect(result.success).toBe(false)
  })
})
