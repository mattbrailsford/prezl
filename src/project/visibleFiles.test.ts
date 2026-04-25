import { describe, expect, it } from 'vitest'
import { computeVisibleFiles } from './visibleFiles'
import { buildScreenIndex } from './stageList'

const SCREENS = buildScreenIndex([
  { alias: 'main', order: 1 },
  { alias: 'shell', order: 2 },
  { alias: 'preview', order: 3 },
])

describe('visibleFiles', () => {
  it('includes files with no directives on every screen', () => {
    const rawFiles = new Map([['a.ts', 'const x = 1']])
    const result = computeVisibleFiles({
      files: ['a.ts'],
      rawFiles,
      currentScreenId: 'main',
      screenIndex: SCREENS,
    })
    expect(result).toEqual(['a.ts'])
  })

  it('hides files whose @prezl file=[stages] excludes the current screen', () => {
    const rawFiles = new Map([
      ['a.ts', 'const x = 1'],
      ['b.ts', '// @prezl file=[preview...]\nconst y = 2'],
    ])
    const onMain = computeVisibleFiles({
      files: ['a.ts', 'b.ts'],
      rawFiles,
      currentScreenId: 'main',
      screenIndex: SCREENS,
    })
    expect(onMain).toEqual(['a.ts'])

    const onPreview = computeVisibleFiles({
      files: ['a.ts', 'b.ts'],
      rawFiles,
      currentScreenId: 'preview',
      screenIndex: SCREENS,
    })
    expect(onPreview).toEqual(['a.ts', 'b.ts'])
  })

  it('skips files whose contents are missing from the rawFiles map', () => {
    const result = computeVisibleFiles({
      files: ['ghost.ts'],
      rawFiles: new Map(),
      currentScreenId: 'main',
      screenIndex: SCREENS,
    })
    expect(result).toEqual([])
  })

  it('respects step-level resolution when stage selectors are bare', () => {
    const stepped = buildScreenIndex([
      { alias: 'main', order: 1 },
      {
        alias: 'shell',
        order: 2,
        steps: [{ alias: 'intro' }, { alias: 'outro' }],
      },
    ])
    const rawFiles = new Map([
      ['a.ts', '// @prezl file=[shell.outro]\nconst y = 2'],
    ])
    expect(
      computeVisibleFiles({
        files: ['a.ts'],
        rawFiles,
        currentScreenId: 'shell.intro',
        screenIndex: stepped,
      }),
    ).toEqual([])
    expect(
      computeVisibleFiles({
        files: ['a.ts'],
        rawFiles,
        currentScreenId: 'shell.outro',
        screenIndex: stepped,
      }),
    ).toEqual(['a.ts'])
  })
})
