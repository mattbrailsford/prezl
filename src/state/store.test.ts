import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './store'
import type { PrezlProject, Stage, VideoPreview } from '@/types'

const TRAILING_VIDEO: VideoPreview = {
  type: 'video',
  src: './v.mp4',
  autoLaunch: 'end',
}

function projectWithTrailingOnStep2(): {
  project: PrezlProject
  rawFiles: Map<string, string>
} {
  const stages: Stage[] = [
    {
      alias: 'preview',
      order: 1,
      steps: [
        { alias: 'intro' },
        { alias: 'fetchImpl', preview: TRAILING_VIDEO },
        { alias: 'chartHelpers', preview: null },
      ],
    },
  ]
  return {
    project: {
      name: 'Test',
      stages,
      files: [],
    },
    rawFiles: new Map(),
  }
}

describe('store — trailing autoLaunch advance flow', () => {
  beforeEach(() => {
    // Reset to initial state between tests.
    useAppStore.getState().clearProject()
  })

  it('opens trailing video on forward advance, then advances on second call', () => {
    const { project, rawFiles } = projectWithTrailingOnStep2()
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'preview')
    // Initial screen is the first of the preview stage (intro).
    expect(useAppStore.getState().currentScreenId).toBe('preview.intro')

    // Walk forward to the trailing screen.
    useAppStore.getState().switchScreenRelative(1)
    expect(useAppStore.getState().currentScreenId).toBe('preview.fetchImpl')
    expect(useAppStore.getState().previewState.kind).toBe('closed')

    // Forward press from the trailing screen opens the modal as trailing
    // and pauses the screen advance.
    useAppStore.getState().switchScreenRelative(1)
    const previewState = useAppStore.getState().previewState
    expect(previewState.kind).toBe('video')
    if (previewState.kind === 'video') {
      expect(previewState.trailing).toBe(true)
      expect(previewState.preview).toBe(TRAILING_VIDEO)
    }
    expect(useAppStore.getState().currentScreenId).toBe('preview.fetchImpl')
    expect(useAppStore.getState().lastEndAutoLaunchedScreenId).toBe(
      'preview.fetchImpl',
    )

    // Simulating the modal's atEnd-Space handler: close the modal, then ask
    // for a forward advance. With the lastEnd guard already set, this should
    // skip the trailing fire and advance to the next screen in one motion.
    useAppStore.getState().closePreview()
    useAppStore.getState().switchScreenRelative(1)
    expect(useAppStore.getState().currentScreenId).toBe('preview.chartHelpers')
    expect(useAppStore.getState().previewState.kind).toBe('closed')
  })

  it('does not re-fire the trailing video on re-traversal', () => {
    const { project, rawFiles } = projectWithTrailingOnStep2()
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'preview')
    // Advance through the trailing flow once.
    useAppStore.getState().switchScreenRelative(1) // intro -> fetchImpl
    useAppStore.getState().switchScreenRelative(1) // opens trailing video
    useAppStore.getState().closePreview()
    useAppStore.getState().switchScreenRelative(1) // -> chartHelpers

    // Walk back to the trailing screen.
    useAppStore.getState().switchScreenRelative(-1)
    expect(useAppStore.getState().currentScreenId).toBe('preview.fetchImpl')

    // Forward press again — should NOT replay the trailing video; just advance.
    useAppStore.getState().switchScreenRelative(1)
    expect(useAppStore.getState().currentScreenId).toBe('preview.chartHelpers')
    expect(useAppStore.getState().previewState.kind).toBe('closed')
  })

  it('does not fire trailing within the preview scope (sticky inheritance)', () => {
    // Stage-level trailing video; every step inherits it. Should fire only
    // when forward-leaving the LAST step of the scope, not every step.
    const stages: Stage[] = [
      {
        alias: 'shell',
        order: 1,
        preview: TRAILING_VIDEO,
        steps: [{ alias: 'a' }, { alias: 'b' }, { alias: 'c' }],
      },
      { alias: 'next', order: 2 },
    ]
    const project: PrezlProject = { name: 'Test', stages, files: [] }
    useAppStore.getState().setProject(project, new Map(), new Set(), 'shell')
    expect(useAppStore.getState().currentScreenId).toBe('shell.a')

    // a -> b: same preview reference, should NOT fire.
    useAppStore.getState().switchScreenRelative(1)
    expect(useAppStore.getState().currentScreenId).toBe('shell.b')
    expect(useAppStore.getState().previewState.kind).toBe('closed')

    // b -> c: still inside the scope, should NOT fire.
    useAppStore.getState().switchScreenRelative(1)
    expect(useAppStore.getState().currentScreenId).toBe('shell.c')
    expect(useAppStore.getState().previewState.kind).toBe('closed')

    // c -> next: leaving the scope, SHOULD fire.
    useAppStore.getState().switchScreenRelative(1)
    expect(useAppStore.getState().currentScreenId).toBe('shell.c')
    expect(useAppStore.getState().previewState.kind).toBe('video')
  })
})

describe('store — stage-level reset flag', () => {
  beforeEach(() => {
    useAppStore.getState().clearProject()
  })

  function projectWithReset(): {
    project: PrezlProject
    rawFiles: Map<string, string>
  } {
    const stages: Stage[] = [
      {
        alias: 'main',
        order: 1,
        open: { file: 'main.ts' },
      },
      {
        alias: 'preview',
        order: 2,
        open: { file: 'dashboard.ts' },
        reset: true,
        steps: [
          { alias: 'a' },
          { alias: 'b', open: { file: 'api.ts' } },
        ],
      },
    ]
    const files = ['main.ts', 'extra.ts', 'dashboard.ts', 'api.ts']
    // computeVisibleFiles skips files missing from rawFiles, so seed every
    // declared file with empty content to make them visible.
    const rawFiles = new Map(files.map((f) => [f, '']))
    return {
      project: { name: 'Test', stages, files },
      rawFiles,
    }
  }

  it('cross-stage entry into a reset stage closes other tabs and bumps the token', () => {
    const { project, rawFiles } = projectWithReset()
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'main')

    // Open an extra tab on the main stage so we can verify it gets closed.
    useAppStore.getState().openFile('extra.ts')
    expect(useAppStore.getState().openTabs).toEqual(['main.ts', 'extra.ts'])
    const tokenBefore = useAppStore.getState().explorerResetToken

    // Cross into preview.a — the stage's open file is dashboard.ts, and
    // since the stage opted into reset, every other tab should drop.
    useAppStore.getState().switchScreen('preview.a')
    expect(useAppStore.getState().currentScreenId).toBe('preview.a')
    expect(useAppStore.getState().openTabs).toEqual(['dashboard.ts'])
    expect(useAppStore.getState().activeFile).toBe('dashboard.ts')
    expect(useAppStore.getState().explorerResetToken).toBe(tokenBefore + 1)
  })

  it('step transition within a reset stage does not re-fire the reset', () => {
    const { project, rawFiles } = projectWithReset()
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'preview')
    // Initial screen is preview.a; reset already fired on this entry path
    // is cosmetic since setProject builds clean state, but the explorer
    // token starts at 0 and shouldn't have moved yet.
    expect(useAppStore.getState().currentScreenId).toBe('preview.a')
    const tokenAfterInitial = useAppStore.getState().explorerResetToken

    // Open an extra tab then walk to step b — the reset must not fire on
    // step transitions, so the extra tab survives the move.
    useAppStore.getState().openFile('extra.ts')
    useAppStore.getState().switchScreen('preview.b')
    expect(useAppStore.getState().currentScreenId).toBe('preview.b')
    expect(useAppStore.getState().openTabs).toContain('extra.ts')
    expect(useAppStore.getState().explorerResetToken).toBe(tokenAfterInitial)
  })

  it('cross-stage entry clears the visited-cover set and seeds the new active file', () => {
    const { project, rawFiles } = projectWithReset()
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'main')
    // visit an extra file on main, then walk into preview.
    useAppStore.getState().openFile('extra.ts')
    expect(useAppStore.getState().visitedFilesInStage).toContain('extra.ts')

    useAppStore.getState().switchScreen('preview.a')
    const visited = useAppStore.getState().visitedFilesInStage
    // main's visits are gone; the new stage's resolved active file is in.
    expect(visited.has('extra.ts')).toBe(false)
    expect(visited.has('main.ts')).toBe(false)
    expect(visited.has('dashboard.ts')).toBe(true)
  })

  it('step transition with a different cover clears visited entries that appear in the new cover', () => {
    // Files visited under step a's cover should become un-ticked again when
    // step b's cover (different reference) lists them — the new step is its
    // own framing and the presenter should be prompted to revisit. Visited
    // entries NOT in the new cover stay ticked.
    const stages: Stage[] = [
      {
        alias: 'preview',
        order: 1,
        steps: [
          { alias: 'a', cover: [{ file: 'dashboard.ts' }], open: { file: 'dashboard.ts' } },
          {
            alias: 'b',
            cover: [{ file: 'dashboard.ts' }, { file: 'api.ts' }],
            open: { file: 'api.ts' },
          },
        ],
      },
    ]
    const project: PrezlProject = {
      name: 'Test',
      stages,
      files: ['dashboard.ts', 'api.ts', 'unrelated.ts'],
    }
    const rawFiles = new Map([
      ['dashboard.ts', ''],
      ['api.ts', ''],
      ['unrelated.ts', ''],
    ])
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'preview')
    expect(useAppStore.getState().currentScreenId).toBe('preview.a')
    // Step a opens dashboard.ts, which is in step a's cover.
    expect(useAppStore.getState().visitedFilesInStage.has('dashboard.ts')).toBe(true)
    // Mark an unrelated file visited — should survive the cover-change reset.
    useAppStore.getState().openFile('unrelated.ts')
    expect(useAppStore.getState().visitedFilesInStage.has('unrelated.ts')).toBe(true)

    useAppStore.getState().switchScreen('preview.b')
    const visited = useAppStore.getState().visitedFilesInStage
    // dashboard.ts is in step b's cover → cleared, so the presenter sees it
    // un-ticked again and is prompted to revisit.
    expect(visited.has('dashboard.ts')).toBe(false)
    // api.ts is the new active file (and in the cover), so it's ticked fresh.
    expect(visited.has('api.ts')).toBe(true)
    // unrelated.ts isn't in the new cover, so it stays ticked.
    expect(visited.has('unrelated.ts')).toBe(true)
  })

  it('step transition with the same cover reference does not clear visits', () => {
    // Sticky-forward inheritance: step b inherits step a's cover by reference
    // (no override). Same reference means no cover change, so visits survive.
    const sharedCover = [{ file: 'dashboard.ts' }]
    const stages: Stage[] = [
      {
        alias: 'preview',
        order: 1,
        cover: sharedCover,
        steps: [
          { alias: 'a', open: { file: 'dashboard.ts' } },
          { alias: 'b', open: { file: 'dashboard.ts' } },
        ],
      },
    ]
    const project: PrezlProject = {
      name: 'Test',
      stages,
      files: ['dashboard.ts'],
    }
    const rawFiles = new Map([['dashboard.ts', '']])
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'preview')
    expect(useAppStore.getState().visitedFilesInStage.has('dashboard.ts')).toBe(true)

    useAppStore.getState().switchScreen('preview.b')
    // Same cover reference: dashboard.ts stays visited.
    expect(useAppStore.getState().visitedFilesInStage.has('dashboard.ts')).toBe(true)
  })

  it('step transition within a stage adds to the visited set without clearing', () => {
    const { project, rawFiles } = projectWithReset()
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'preview')
    // Initial screen preview.a opens dashboard.ts.
    expect(useAppStore.getState().visitedFilesInStage.has('dashboard.ts')).toBe(
      true,
    )
    useAppStore.getState().switchScreen('preview.b')
    const visited = useAppStore.getState().visitedFilesInStage
    expect(visited.has('dashboard.ts')).toBe(true) // survived step transition
    expect(visited.has('api.ts')).toBe(true) // step b's open
  })

  it('back-nav into a reset stage does not trigger a reset', () => {
    const { project, rawFiles } = projectWithReset()
    useAppStore.getState().setProject(project, rawFiles, new Set(), 'preview')
    // Stack a useful history: open extra, then move forward into main.
    useAppStore.getState().openFile('extra.ts')
    useAppStore.getState().switchScreen('main')
    const tokenAfterForward = useAppStore.getState().explorerResetToken

    // Open another tab on main to prove it survives the back-nav.
    useAppStore.getState().openFile('api.ts')
    useAppStore.getState().goBack() // back to preview's last entry
    expect(useAppStore.getState().currentScreenId).toBe('main')
    // goBack walks one step at a time; one more step lands us on preview.
    useAppStore.getState().goBack()
    expect(useAppStore.getState().currentScreenId).toBe('preview.a')
    // Crucially: no reset signal fired. The extra tab from earlier should
    // still be on the tab strip.
    expect(useAppStore.getState().openTabs).toContain('api.ts')
    expect(useAppStore.getState().explorerResetToken).toBe(tokenAfterForward)
  })
})
