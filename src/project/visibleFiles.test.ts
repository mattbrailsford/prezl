import { describe, expect, it } from 'vitest'
import { computeFileVisibility, computeVisibleFiles } from './visibleFiles'
import { buildScreenIndex } from './stageList'

const SCREENS = buildScreenIndex([
  { id: 'main', order: 1 },
  { id: 'shell', order: 2 },
  { id: 'preview', order: 3 },
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

    const onDemo = computeVisibleFiles({
      files: ['a.ts', 'b.ts'],
      rawFiles,
      currentScreenId: 'preview',
      screenIndex: SCREENS,
    })
    expect(onDemo).toEqual(['a.ts', 'b.ts'])
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

  it('includes binary files even though they are absent from rawFiles', () => {
    const result = computeVisibleFiles({
      files: ['logo.png', 'a.ts'],
      rawFiles: new Map([['a.ts', 'const x = 1']]),
      binaryFiles: new Set(['logo.png']),
      currentScreenId: 'main',
      screenIndex: SCREENS,
    })
    expect(result).toEqual(['logo.png', 'a.ts'])
  })

  it('surfaces files focused via file= sibling focus= on matching screens', () => {
    const rawFiles = new Map([
      ['a.ts', '// @prezl file=[shell...] focus=[shell]\nconst x = 1'],
      ['b.ts', 'const y = 2'],
    ])
    const onShell = computeFileVisibility({
      files: ['a.ts', 'b.ts'],
      rawFiles,
      currentScreenId: 'shell',
      screenIndex: SCREENS,
    })
    expect(onShell.visible).toEqual(['a.ts', 'b.ts'])
    expect([...onShell.focused]).toEqual(['a.ts'])

    const onDemo = computeFileVisibility({
      files: ['a.ts', 'b.ts'],
      rawFiles,
      currentScreenId: 'preview',
      screenIndex: SCREENS,
    })
    expect(onDemo.visible).toEqual(['a.ts', 'b.ts'])
    expect(onDemo.focused.size).toBe(0)
  })

  it('omits hidden files from the focused set even with matching focus selectors', () => {
    const rawFiles = new Map([
      ['a.ts', '// @prezl file=[shell] focus=[main]\nconst x = 1'],
    ])
    const onMain = computeFileVisibility({
      files: ['a.ts'],
      rawFiles,
      currentScreenId: 'main',
      screenIndex: SCREENS,
    })
    expect(onMain.visible).toEqual([])
    expect(onMain.focused.size).toBe(0)
  })

  it('respects step-level resolution when stage selectors are bare', () => {
    const stepped = buildScreenIndex([
      { id: 'main', order: 1 },
      {
        id: 'shell',
        order: 2,
        steps: [{ id: 'intro' }, { id: 'outro' }],
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
