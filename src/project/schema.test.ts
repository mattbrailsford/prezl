import { describe, expect, it } from 'vitest'
import { prezlProjectSchema } from './schema'

function parsePreview(autoLaunch: unknown) {
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
  const preview = result.data.stages[0].preview
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
    type ObjectStep = { preview?: unknown; open?: unknown }
    const step = result.data.stages[0].steps?.[1] as ObjectStep | undefined
    return { ok: true as const, step }
  }

  it('accepts preview: null on a step', () => {
    const r = parseStep({ preview: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.step?.preview).toBeNull()
  })

  it('accepts open: null on a step', () => {
    const r = parseStep({ open: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.step?.open).toBeNull()
  })

  it('keeps preview undefined when omitted (sticky inheritance)', () => {
    const r = parseStep({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.step?.preview).toBeUndefined()
      expect(r.step?.open).toBeUndefined()
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
