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

  it("step 1's omitted open seeds from the stage default; later omitted steps are no-opinion", () => {
    // Step 1 entering a stepped stage IS the author's "land here" intent
    // for the stage, so we honor stage.open. But step 2's omitted open is
    // "I don't care" — the reducer's prior-active-file rule keeps the file
    // active, AND a presenter-initiated close survives the step transition
    // (no force-reopen).
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
    expect(idx.byId['shell.three'].open).toBeUndefined()
  })

  it('preserves preview reference identity across inherited steps', () => {
    // Autolaunch in the store relies on this: shared identity = "no
    // authorial change", so subsequent steps that inherit the stage's
    // preview don't re-fire the video modal.
    const stagePreview = {
      type: 'video' as const,
      src: 'intro.mp4',
      autoLaunch: 'start' as const,
    }
    const overridePreview = {
      type: 'video' as const,
      src: 'middle.mp4',
    }
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        preview: stagePreview,
        steps: [
          { alias: 'one' },
          { alias: 'two', preview: overridePreview },
          { alias: 'three' },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.one'].preview).toBe(stagePreview)
    expect(idx.byId['shell.two'].preview).toBe(overridePreview)
    // step three inherits step two's override — same reference, not a new copy.
    expect(idx.byId['shell.three'].preview).toBe(overridePreview)
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

  it('resets a step preview to the stage default when set to null', () => {
    // The motivating case for the reset escape hatch: step B declares an
    // override (e.g. a trailing-video preview) and the author wants step C
    // to drop that and revert to the stage's plain preview rather than
    // inherit B's override via sticky-forward.
    const stagePreview = {
      type: 'video' as const,
      src: 'stage.mp4',
    }
    const stepBPreview = {
      type: 'video' as const,
      src: 'b.mp4',
      autoLaunch: 'end' as const,
    }
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        preview: stagePreview,
        steps: [
          { alias: 'a' },
          { alias: 'b', preview: stepBPreview },
          { alias: 'c', preview: null },
          { alias: 'd' },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.a'].preview).toBe(stagePreview)
    expect(idx.byId['shell.b'].preview).toBe(stepBPreview)
    // Reset: c falls back to the stage's preview, NOT b's override.
    expect(idx.byId['shell.c'].preview).toBe(stagePreview)
    // And d inherits c's resolved value (which is the stage default), so
    // sticky-forward continues from the reset point — not from b.
    expect(idx.byId['shell.d'].preview).toBe(stagePreview)
  })

  it('resets a step open to the stage default when set to null', () => {
    const stageOpen = { file: 'main.ts', line: 1 }
    const stepBOpen = { file: 'b.ts', line: 1 }
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        open: stageOpen,
        steps: [
          { alias: 'a' },
          { alias: 'b', open: stepBOpen },
          { alias: 'c', open: null },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.a'].open).toBe(stageOpen)
    expect(idx.byId['shell.b'].open).toBe(stepBOpen)
    expect(idx.byId['shell.c'].open).toBe(stageOpen)
  })

  it('propagates a stage-level null open to a no-step screen', () => {
    // `open: ~` at the stage level means "this screen has no file open".
    // The reducer keys on screen.open === null, so the screen index must
    // carry the explicit null through (not collapse it to undefined).
    const stages: Stage[] = [{ alias: 'intro', order: 1, open: null }]
    const idx = buildScreenIndex(stages)
    expect(idx.byId.intro.open).toBeNull()
  })

  it('a stage-level null open seeds step 1; later omitted steps are no-opinion', () => {
    // Step 1 inherits the stage's explicit `null` so the reducer clears any
    // tabs that bled in from a prior stage. Step 2's omitted open is
    // no-opinion at runtime — if the presenter happens to have opened
    // something during step 1, it stays open instead of getting force-closed
    // again.
    const stages: Stage[] = [
      {
        alias: 'intro',
        order: 1,
        open: null,
        steps: [{ alias: 'one' }, { alias: 'two' }],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['intro.one'].open).toBeNull()
    expect(idx.byId['intro.two'].open).toBeUndefined()
  })

  it('a step under a null-open stage can open a file; later omitted steps are no-opinion', () => {
    const stepOpen = { file: 'a.ts' }
    const stages: Stage[] = [
      {
        alias: 'intro',
        order: 1,
        open: null,
        steps: [
          { alias: 'tree' },
          { alias: 'reveal', open: stepOpen },
          { alias: 'follow' },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['intro.tree'].open).toBeNull()
    expect(idx.byId['intro.reveal'].open).toBe(stepOpen)
    // follow has no opinion — the reducer's prior-active-file rule keeps
    // a.ts active without force-reopening it after a presenter close.
    expect(idx.byId['intro.follow'].open).toBeUndefined()
  })

  it('a partial step open inherits file across an omitted-open gap', () => {
    // Even though the omitted step in between resolves to undefined at the
    // screen level, the partial-open file inheritance reaches back to the
    // most recent resolved open that had a file.
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        open: { file: 'a.ts' },
        steps: [
          { alias: 'one' },
          { alias: 'two' },
          { alias: 'three', open: { id: 'foo' } },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.one'].open?.file).toBe('a.ts')
    expect(idx.byId['shell.two'].open).toBeUndefined()
    expect(idx.byId['shell.three'].open).toEqual({ file: 'a.ts', id: 'foo' })
  })

  it('a step can reset back to a null-open stage default', () => {
    const stepOpen = { file: 'a.ts' }
    const stages: Stage[] = [
      {
        alias: 'intro',
        order: 1,
        open: null,
        steps: [
          { alias: 'one', open: stepOpen },
          { alias: 'two', open: null },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['intro.one'].open).toBe(stepOpen)
    // step two resets to the stage default, which is itself null.
    expect(idx.byId['intro.two'].open).toBeNull()
  })

  it('a step open with only an id inherits the file from prev', () => {
    // Common authoring shape for a stepped stage walking through one file:
    // step 1 opens the file, step 2+ jump to specific anchors with just
    // `{ id: ... }`. The resolver fills in the file so downstream code
    // (CodeView, the reducer's openIntent check) works as if the author
    // had written the file path on each step.
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        open: { file: 'a.ts' },
        steps: [
          { alias: 'one' },
          { alias: 'two', open: { id: 'foo' } },
          { alias: 'three', open: { line: 42 } },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.two'].open).toEqual({ file: 'a.ts', id: 'foo' })
    // Sticky-forward continues from the merged value, so step three
    // inherits a.ts as well, then overrides position with line 42.
    expect(idx.byId['shell.three'].open).toEqual({ file: 'a.ts', line: 42 })
  })

  it('a step partial open after a file change inherits the new file', () => {
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        open: { file: 'a.ts' },
        steps: [
          { alias: 'one' },
          { alias: 'two', open: { file: 'b.ts' } },
          { alias: 'three', open: { id: 'foo' } },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.three'].open).toEqual({ file: 'b.ts', id: 'foo' })
  })

  it('a step partial open with no inheritable file leaves file unset', () => {
    // Stage default is null (no file), so step one's partial open has
    // nothing to merge. The resolved open keeps file undefined; the
    // viewer falls back to whatever activeFile is at scroll time.
    const stages: Stage[] = [
      {
        alias: 'intro',
        order: 1,
        open: null,
        steps: [{ alias: 'one', open: { id: 'foo' } }],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['intro.one'].open).toEqual({ id: 'foo' })
  })

  it('a stage cover propagates to the no-step screen', () => {
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        cover: [{ file: 'a.ts' }, { file: 'b.ts', id: 'foo' }],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId.shell.cover).toEqual([
      { file: 'a.ts' },
      { file: 'b.ts', id: 'foo' },
    ])
  })

  it('every step in a stage inherits the stage cover by default', () => {
    const stageCover = [{ file: 'a.ts' }, { file: 'b.ts' }]
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        cover: stageCover,
        steps: [{ alias: 'one' }, { alias: 'two' }],
      },
    ]
    const idx = buildScreenIndex(stages)
    // Reference identity preserved across inherited steps — same as preview.
    expect(idx.byId['shell.one'].cover).toBe(stageCover)
    expect(idx.byId['shell.two'].cover).toBe(stageCover)
  })

  it('a step can override the stage cover and later steps inherit the override', () => {
    const stageCover = [{ file: 'a.ts' }]
    const stepCover = [{ file: 'b.ts' }, { file: 'c.ts' }]
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        cover: stageCover,
        steps: [
          { alias: 'one' },
          { alias: 'two', cover: stepCover },
          { alias: 'three' },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.one'].cover).toBe(stageCover)
    expect(idx.byId['shell.two'].cover).toBe(stepCover)
    expect(idx.byId['shell.three'].cover).toBe(stepCover)
  })

  it('a step can reset cover back to the stage default', () => {
    const stageCover = [{ file: 'a.ts' }]
    const stepCover = [{ file: 'b.ts' }]
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        cover: stageCover,
        steps: [
          { alias: 'one', cover: stepCover },
          { alias: 'two', cover: null },
          { alias: 'three' },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.one'].cover).toBe(stepCover)
    expect(idx.byId['shell.two'].cover).toBe(stageCover)
    // sticky-forward continues from the reset value (stage default), not the
    // earlier override.
    expect(idx.byId['shell.three'].cover).toBe(stageCover)
  })

  it('cover does not propagate across stage boundaries', () => {
    const aCover = [{ file: 'a.ts' }]
    const stages: Stage[] = [
      { alias: 'first', order: 1, cover: aCover },
      { alias: 'second', order: 2 },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId.first.cover).toBe(aCover)
    expect(idx.byId.second.cover).toBeUndefined()
  })

  it('reset on a step whose stage has no default leaves the field unset', () => {
    const stepBPreview = {
      type: 'video' as const,
      src: 'b.mp4',
    }
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        // No stage-level preview.
        steps: [
          { alias: 'a' },
          { alias: 'b', preview: stepBPreview },
          { alias: 'c', preview: null },
        ],
      },
    ]
    const idx = buildScreenIndex(stages)
    expect(idx.byId['shell.a'].preview).toBeUndefined()
    expect(idx.byId['shell.b'].preview).toBe(stepBPreview)
    // No stage default to fall back to → unset.
    expect(idx.byId['shell.c'].preview).toBeUndefined()
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
