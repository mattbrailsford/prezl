import { describe, expect, it } from 'vitest'
import { reconcileBranchSwitch } from './branchReducer'
import type { Branch } from '@/types'

function branch(partial: Partial<Branch> = {}): Branch {
  return {
    name: 'feature/x',
    alias: 'x',
    order: 1,
    ...partial,
  }
}

describe('reconcileBranchSwitch', () => {
  it('closes tabs for files no longer visible', () => {
    const result = reconcileBranchSwitch({
      branch: branch(),
      visibleFiles: ['src/a.ts'],
      openTabs: ['src/a.ts', 'src/b.ts'],
      activeFile: 'src/b.ts',
    })
    expect(result.openTabs).toEqual(['src/a.ts'])
    expect(result.activeFile).toBe('src/a.ts')
  })

  it('honors branch.open.file, opening it and making it active', () => {
    const result = reconcileBranchSwitch({
      branch: branch({ open: { file: 'src/c.ts' } }),
      visibleFiles: ['src/a.ts', 'src/c.ts'],
      openTabs: ['src/a.ts'],
      activeFile: 'src/a.ts',
    })
    expect(result.openTabs).toEqual(['src/a.ts', 'src/c.ts'])
    expect(result.activeFile).toBe('src/c.ts')
  })

  it('ignores branch.open.file when the file is not visible on this stage', () => {
    const result = reconcileBranchSwitch({
      branch: branch({ open: { file: 'src/missing.ts' } }),
      visibleFiles: ['src/a.ts'],
      openTabs: ['src/a.ts'],
      activeFile: 'src/a.ts',
    })
    expect(result.openTabs).toEqual(['src/a.ts'])
    expect(result.activeFile).toBe('src/a.ts')
  })

  it('falls back to the first visible file when no tabs remain', () => {
    const result = reconcileBranchSwitch({
      branch: branch(),
      visibleFiles: ['src/x.ts', 'src/y.ts'],
      openTabs: [],
      activeFile: null,
    })
    expect(result.openTabs).toEqual(['src/x.ts'])
    expect(result.activeFile).toBe('src/x.ts')
  })

  it('preserves the previously active file if still visible and no open intent', () => {
    const result = reconcileBranchSwitch({
      branch: branch(),
      visibleFiles: ['src/a.ts', 'src/b.ts'],
      openTabs: ['src/a.ts', 'src/b.ts'],
      activeFile: 'src/a.ts',
    })
    expect(result.activeFile).toBe('src/a.ts')
  })
})
