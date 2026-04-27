import { describe, expect, it } from 'vitest'
import { applyStageEntryReset, reconcileScreenSwitch } from './stageReducer'
import type { Screen } from '@/types'

function screen(partial: Partial<Screen> = {}): Screen {
  return {
    id: 'x',
    stageAlias: 'x',
    stepAlias: null,
    order: 0,
    ...partial,
  }
}

describe('reconcileScreenSwitch', () => {
  it('closes tabs for files no longer visible', () => {
    const result = reconcileScreenSwitch({
      screen: screen(),
      visibleFiles: ['src/a.ts'],
      openTabs: ['src/a.ts', 'src/b.ts'],
      activeFile: 'src/b.ts',
    })
    expect(result.openTabs).toEqual(['src/a.ts'])
    expect(result.activeFile).toBe('src/a.ts')
  })

  it('honors screen.open.file, opening it and making it active', () => {
    const result = reconcileScreenSwitch({
      screen: screen({ open: { file: 'src/c.ts' } }),
      visibleFiles: ['src/a.ts', 'src/c.ts'],
      openTabs: ['src/a.ts'],
      activeFile: 'src/a.ts',
    })
    expect(result.openTabs).toEqual(['src/a.ts', 'src/c.ts'])
    expect(result.activeFile).toBe('src/c.ts')
  })

  it('ignores screen.open.file when the file is not visible on this screen', () => {
    const result = reconcileScreenSwitch({
      screen: screen({ open: { file: 'src/missing.ts' } }),
      visibleFiles: ['src/a.ts'],
      openTabs: ['src/a.ts'],
      activeFile: 'src/a.ts',
    })
    expect(result.openTabs).toEqual(['src/a.ts'])
    expect(result.activeFile).toBe('src/a.ts')
  })

  it('falls back to the first visible file when no tabs remain', () => {
    const result = reconcileScreenSwitch({
      screen: screen(),
      visibleFiles: ['src/x.ts', 'src/y.ts'],
      openTabs: [],
      activeFile: null,
    })
    expect(result.openTabs).toEqual(['src/x.ts'])
    expect(result.activeFile).toBe('src/x.ts')
  })

  it('preserves the previously active file if still visible and no open intent', () => {
    const result = reconcileScreenSwitch({
      screen: screen(),
      visibleFiles: ['src/a.ts', 'src/b.ts'],
      openTabs: ['src/a.ts', 'src/b.ts'],
      activeFile: 'src/a.ts',
    })
    expect(result.activeFile).toBe('src/a.ts')
  })

  it('clears every tab and active file when screen.open is explicitly null', () => {
    // Author wrote `open: ~` — "no file open" intro state. The
    // first-visible-file fallback must be skipped so the editor pane
    // really does stay empty.
    const result = reconcileScreenSwitch({
      screen: screen({ open: null }),
      visibleFiles: ['src/a.ts', 'src/b.ts'],
      openTabs: ['src/a.ts', 'src/b.ts'],
      activeFile: 'src/a.ts',
    })
    expect(result.openTabs).toEqual([])
    expect(result.activeFile).toBeNull()
  })
})

describe('applyStageEntryReset', () => {
  it('collapses openTabs to just the active file', () => {
    const result = applyStageEntryReset({
      openTabs: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      activeFile: 'src/b.ts',
    })
    expect(result.openTabs).toEqual(['src/b.ts'])
    expect(result.activeFile).toBe('src/b.ts')
  })

  it('returns empty tabs when there is no active file', () => {
    const result = applyStageEntryReset({
      openTabs: ['src/a.ts'],
      activeFile: null,
    })
    expect(result.openTabs).toEqual([])
    expect(result.activeFile).toBeNull()
  })

  it('keeps the active file even if it was the only tab', () => {
    const result = applyStageEntryReset({
      openTabs: ['src/a.ts'],
      activeFile: 'src/a.ts',
    })
    expect(result.openTabs).toEqual(['src/a.ts'])
    expect(result.activeFile).toBe('src/a.ts')
  })
})
