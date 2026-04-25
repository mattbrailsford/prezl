import { describe, expect, it } from 'vitest'
import { buildScreenIndex, parseScreenList } from './stageList'
import type { Stage } from '@/types'

const FLAT_STAGES: Stage[] = [
  { alias: 'main', order: 1 },
  { alias: 'shell', order: 2 },
  { alias: 'preview', order: 3 },
  { alias: 'demo', order: 4 },
]

const FLAT = buildScreenIndex(FLAT_STAGES)

const STEPPED_STAGES: Stage[] = [
  { alias: 'main', order: 1 },
  {
    alias: 'shell',
    order: 2,
    steps: [
      { alias: 'intro' },
      { alias: 'showHandler' },
      { alias: 'outro' },
    ],
  },
  {
    alias: 'preview',
    order: 3,
    steps: [{ alias: 'fetch' }, { alias: 'render' }],
  },
  { alias: 'demo', order: 4 },
]

const STEPPED = buildScreenIndex(STEPPED_STAGES)

function flatMatch(input: string | null, screen: string): boolean | string {
  const r = parseScreenList(input, FLAT)
  return r.ok ? r.matches(screen) : r.error
}

function steppedMatch(input: string | null, screen: string): boolean | string {
  const r = parseScreenList(input, STEPPED)
  return r.ok ? r.matches(screen) : r.error
}

describe('buildScreenIndex', () => {
  it('produces one implicit screen per stage when no steps', () => {
    expect(FLAT.ordered.map((s) => s.id)).toEqual([
      'main',
      'shell',
      'preview',
      'demo',
    ])
    expect(FLAT.byId.shell.stepAlias).toBeNull()
  })

  it('expands stage.steps into one screen per step with dotted ids', () => {
    expect(STEPPED.ordered.map((s) => s.id)).toEqual([
      'main',
      'shell.intro',
      'shell.showHandler',
      'shell.outro',
      'preview.fetch',
      'preview.render',
      'demo',
    ])
  })

  it('records flat order bounds per stage', () => {
    expect(STEPPED.byStage.shell).toMatchObject({ first: 1, last: 3 })
    expect(STEPPED.byStage.preview).toMatchObject({ first: 4, last: 5 })
    expect(STEPPED.byStage.demo).toMatchObject({ first: 6, last: 6 })
  })

  it('inherits step open from previous step (sticky carry-forward)', () => {
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        open: { file: 'a.ts' },
        steps: [
          { alias: 'one' },
          { alias: 'two', open: { file: 'b.ts' } },
          { alias: 'three' },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.one'].open?.file).toBe('a.ts')
    expect(idx.byId['shell.two'].open?.file).toBe('b.ts')
    expect(idx.byId['shell.three'].open?.file).toBe('b.ts')
  })

  it('throws on duplicate step alias within a stage', () => {
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        steps: [{ alias: 'dup' }, { alias: 'dup' }],
      },
    ]
    expect(() => buildScreenIndex(stages)).toThrow(/duplicate step alias/)
  })
})

describe('parseScreenList — flat (no steps)', () => {
  it('matches every screen when input is empty or null', () => {
    expect(flatMatch(null, 'main')).toBe(true)
    expect(flatMatch('', 'demo')).toBe(true)
    expect(flatMatch('  ', 'shell')).toBe(true)
  })

  it('matches an exact single alias', () => {
    expect(flatMatch('shell', 'shell')).toBe(true)
    expect(flatMatch('shell', 'main')).toBe(false)
  })

  it('matches any alias in an explicit list', () => {
    expect(flatMatch('shell, preview', 'preview')).toBe(true)
    expect(flatMatch('shell, preview', 'demo')).toBe(false)
    expect(flatMatch('shell, preview, demo', 'shell')).toBe(true)
  })

  it('resolves closed ranges by screen order', () => {
    expect(flatMatch('shell...preview', 'shell')).toBe(true)
    expect(flatMatch('shell...preview', 'preview')).toBe(true)
    expect(flatMatch('shell...preview', 'demo')).toBe(false)
    expect(flatMatch('shell...preview', 'main')).toBe(false)
  })

  it('resolves open-ended ranges (from)', () => {
    expect(flatMatch('shell...', 'shell')).toBe(true)
    expect(flatMatch('shell...', 'demo')).toBe(true)
    expect(flatMatch('shell...', 'main')).toBe(false)
  })

  it('resolves open-ended ranges (to)', () => {
    expect(flatMatch('...preview', 'main')).toBe(true)
    expect(flatMatch('...preview', 'preview')).toBe(true)
    expect(flatMatch('...preview', 'demo')).toBe(false)
  })

  it('mixes ranges with explicit items', () => {
    expect(flatMatch('shell...preview, demo', 'demo')).toBe(true)
    expect(flatMatch('shell...preview, demo', 'main')).toBe(false)
  })

  it('errors on unknown alias', () => {
    expect(flatMatch('ghost', 'shell')).toMatch(/unknown stage alias: ghost/)
    expect(flatMatch('shell...ghost', 'shell')).toMatch(
      /unknown stage alias: ghost/,
    )
  })

  it('errors on inverted range', () => {
    expect(flatMatch('demo...shell', 'shell')).toMatch(/inverted range/)
  })

  it('ignores surrounding whitespace', () => {
    expect(flatMatch(' shell , preview ', 'preview')).toBe(true)
    expect(flatMatch(' shell ... preview ', 'preview')).toBe(true)
  })
})

describe('parseScreenList — stepped', () => {
  it('bare stage alias matches every screen of that stage', () => {
    expect(steppedMatch('shell', 'shell.intro')).toBe(true)
    expect(steppedMatch('shell', 'shell.showHandler')).toBe(true)
    expect(steppedMatch('shell', 'shell.outro')).toBe(true)
    expect(steppedMatch('shell', 'preview.fetch')).toBe(false)
    expect(steppedMatch('shell', 'main')).toBe(false)
  })

  it('dotted ref matches only that screen', () => {
    expect(steppedMatch('shell.showHandler', 'shell.showHandler')).toBe(true)
    expect(steppedMatch('shell.showHandler', 'shell.intro')).toBe(false)
  })

  it('bare stage on LHS of range resolves to its first screen', () => {
    expect(steppedMatch('shell...preview.fetch', 'shell.intro')).toBe(true)
    expect(steppedMatch('shell...preview.fetch', 'shell.outro')).toBe(true)
    expect(steppedMatch('shell...preview.fetch', 'preview.fetch')).toBe(true)
    expect(steppedMatch('shell...preview.fetch', 'preview.render')).toBe(false)
    expect(steppedMatch('shell...preview.fetch', 'main')).toBe(false)
  })

  it('bare stage on RHS of range resolves to its last screen', () => {
    expect(steppedMatch('shell.outro...preview', 'shell.outro')).toBe(true)
    expect(steppedMatch('shell.outro...preview', 'preview.fetch')).toBe(true)
    expect(steppedMatch('shell.outro...preview', 'preview.render')).toBe(true)
    expect(steppedMatch('shell.outro...preview', 'demo')).toBe(false)
  })

  it('cross-stage dotted range crosses stage boundaries naturally', () => {
    expect(
      steppedMatch('shell.showHandler...preview.fetch', 'shell.outro'),
    ).toBe(true)
    expect(
      steppedMatch('shell.showHandler...preview.fetch', 'shell.intro'),
    ).toBe(false)
    expect(
      steppedMatch('shell.showHandler...preview.fetch', 'preview.render'),
    ).toBe(false)
  })

  it('open-ended dotted range from a step', () => {
    expect(steppedMatch('shell.outro...', 'shell.outro')).toBe(true)
    expect(steppedMatch('shell.outro...', 'preview.fetch')).toBe(true)
    expect(steppedMatch('shell.outro...', 'demo')).toBe(true)
    expect(steppedMatch('shell.outro...', 'shell.showHandler')).toBe(false)
  })

  it('errors on unknown step alias with stage qualifier in message', () => {
    expect(steppedMatch('shell.ghost', 'shell.intro')).toMatch(
      /unknown step alias: shell\.ghost/,
    )
  })

  it('errors on unknown stage alias even when dotted', () => {
    expect(steppedMatch('ghost.intro', 'shell.intro')).toMatch(
      /unknown stage alias: ghost/,
    )
  })

  it('errors on inverted dotted range', () => {
    expect(
      steppedMatch('preview.render...shell.intro', 'shell.intro'),
    ).toMatch(/inverted range/)
  })
})
