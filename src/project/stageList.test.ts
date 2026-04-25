import { describe, expect, it } from 'vitest'
import { buildStageIndex, parseStageList } from './stageList'

const index = buildStageIndex([
  { alias: 'main', order: 1 },
  { alias: 'shell', order: 2 },
  { alias: 'preview', order: 3 },
  { alias: 'demo', order: 4 },
])

function match(input: string | null, stage: string): boolean | string {
  const result = parseStageList(input, index)
  if (!result.ok) return result.error
  return result.matches(stage)
}

describe('stageList grammar', () => {
  it('matches every stage when input is empty or null', () => {
    expect(match(null, 'main')).toBe(true)
    expect(match('', 'demo')).toBe(true)
    expect(match('  ', 'shell')).toBe(true)
  })

  it('matches an exact single alias', () => {
    expect(match('shell', 'shell')).toBe(true)
    expect(match('shell', 'main')).toBe(false)
  })

  it('matches any alias in an explicit list', () => {
    expect(match('shell, preview', 'preview')).toBe(true)
    expect(match('shell, preview', 'demo')).toBe(false)
    expect(match('shell, preview, demo', 'shell')).toBe(true)
  })

  it('resolves closed ranges by stage order', () => {
    expect(match('shell...preview', 'shell')).toBe(true)
    expect(match('shell...preview', 'preview')).toBe(true)
    expect(match('shell...preview', 'demo')).toBe(false)
    expect(match('shell...preview', 'main')).toBe(false)
  })

  it('resolves open-ended ranges (from)', () => {
    expect(match('shell...', 'shell')).toBe(true)
    expect(match('shell...', 'preview')).toBe(true)
    expect(match('shell...', 'demo')).toBe(true)
    expect(match('shell...', 'main')).toBe(false)
  })

  it('resolves open-ended ranges (to)', () => {
    expect(match('...preview', 'main')).toBe(true)
    expect(match('...preview', 'preview')).toBe(true)
    expect(match('...preview', 'demo')).toBe(false)
  })

  it('mixes ranges with explicit items', () => {
    expect(match('shell...preview, demo', 'shell')).toBe(true)
    expect(match('shell...preview, demo', 'preview')).toBe(true)
    expect(match('shell...preview, demo', 'demo')).toBe(true)
    expect(match('shell...preview, demo', 'main')).toBe(false)
  })

  it('errors on unknown alias', () => {
    expect(match('ghost', 'shell')).toMatch(/unknown stage alias: ghost/)
    expect(match('shell...ghost', 'shell')).toMatch(/unknown stage alias: ghost/)
  })

  it('errors on inverted range', () => {
    expect(match('demo...shell', 'shell')).toMatch(/inverted range/)
  })

  it('ignores surrounding whitespace', () => {
    expect(match('  shell  ', 'shell')).toBe(true)
    expect(match(' shell , preview ', 'preview')).toBe(true)
    expect(match(' shell ... preview ', 'preview')).toBe(true)
  })
})
