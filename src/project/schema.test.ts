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
