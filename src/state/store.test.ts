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
    useAppStore.getState().setProject(project, rawFiles, 'preview')
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
    useAppStore.getState().setProject(project, rawFiles, 'preview')
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
    useAppStore.getState().setProject(project, new Map(), 'shell')
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
