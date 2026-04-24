import { describe, expect, it } from 'vitest'
import { computeVisibleFiles } from './visibleFiles'
import { buildStageIndex } from './stageList'

const STAGES = buildStageIndex([
  { alias: 'main', order: 1 },
  { alias: 'shell', order: 2 },
  { alias: 'preview', order: 3 },
])

describe('visibleFiles', () => {
  it('includes files with no directives on every stage', () => {
    const rawFiles = new Map([['a.ts', 'const x = 1']])
    const result = computeVisibleFiles({
      files: ['a.ts'],
      rawFiles,
      currentStageAlias: 'main',
      stageIndex: STAGES,
    })
    expect(result).toEqual(['a.ts'])
  })

  it('hides files whose @prezl file=[stages] excludes the current stage', () => {
    const rawFiles = new Map([
      ['a.ts', 'const x = 1'],
      ['b.ts', '// @prezl file=[preview...]\nconst y = 2'],
    ])
    const onMain = computeVisibleFiles({
      files: ['a.ts', 'b.ts'],
      rawFiles,
      currentStageAlias: 'main',
      stageIndex: STAGES,
    })
    expect(onMain).toEqual(['a.ts'])

    const onPreview = computeVisibleFiles({
      files: ['a.ts', 'b.ts'],
      rawFiles,
      currentStageAlias: 'preview',
      stageIndex: STAGES,
    })
    expect(onPreview).toEqual(['a.ts', 'b.ts'])
  })

  it('skips files whose contents are missing from the rawFiles map', () => {
    const result = computeVisibleFiles({
      files: ['ghost.ts'],
      rawFiles: new Map(),
      currentStageAlias: 'main',
      stageIndex: STAGES,
    })
    expect(result).toEqual([])
  })
})
