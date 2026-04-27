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
