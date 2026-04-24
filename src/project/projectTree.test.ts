import { describe, expect, it } from 'vitest'
import { groupFilesByProject } from './projectTree'

describe('groupFilesByProject', () => {
  it('returns a single catch-all group when no projects are declared', () => {
    const tree = groupFilesByProject(['a.ts', 'b/c.ts'], undefined)
    expect(tree).toHaveLength(1)
    expect(tree[0].kind).toBe('catch-all')
  })

  it('returns [] when both files and projects are empty', () => {
    expect(groupFilesByProject([], undefined)).toEqual([])
    expect(groupFilesByProject([], [])).toEqual([])
  })

  it('routes each file to the project with the longest matching path', () => {
    const tree = groupFilesByProject(
      [
        'src/Backend/Program.cs',
        'src/Backend/Api/Weather.cs',
        'src/Frontend/App.razor',
        'README.md',
      ],
      [
        { name: 'Backend', path: 'src/Backend' },
        { name: 'Frontend', path: 'src/Frontend' },
      ],
    )
    expect(tree.map((g) => g.kind)).toEqual(['project', 'project', 'catch-all'])
    const [backend, frontend, catchAll] = tree
    expect((backend as { name: string }).name).toBe('Backend')
    expect((frontend as { name: string }).name).toBe('Frontend')
    // Catch-all picks up README.md which didn't match either project
    expect(catchAll.children.map((n) => n.kind === 'file' ? n.fullPath : n.name)).toContain('README.md')
  })

  it('drops projects with no visible files', () => {
    const tree = groupFilesByProject(
      ['src/Frontend/App.razor'],
      [
        { name: 'Backend', path: 'src/Backend' },
        { name: 'Frontend', path: 'src/Frontend' },
      ],
    )
    expect(tree).toHaveLength(1)
    expect((tree[0] as { name: string }).name).toBe('Frontend')
  })

  it('preserves the declaration order of non-empty projects', () => {
    const tree = groupFilesByProject(
      ['src/Frontend/App.razor', 'src/Backend/Program.cs'],
      [
        { name: 'Backend', path: 'src/Backend' },
        { name: 'Frontend', path: 'src/Frontend' },
      ],
    )
    expect(tree.map((g) => g.kind === 'project' ? g.name : g.kind)).toEqual([
      'Backend',
      'Frontend',
    ])
  })

  it('assigns unique folder keys across groups', () => {
    const tree = groupFilesByProject(
      ['src/Backend/src/Program.cs', 'src/Frontend/src/App.razor'],
      [
        { name: 'Backend', path: 'src/Backend' },
        { name: 'Frontend', path: 'src/Frontend' },
      ],
    )
    const keys: string[] = []
    for (const group of tree) {
      for (const child of group.children) {
        if (child.kind === 'folder') keys.push(child.key)
      }
    }
    // Both groups have an "src" folder — their keys must differ
    expect(keys).toHaveLength(2)
    expect(new Set(keys).size).toBe(2)
  })

  it('uses file paths that still point at the real project-root-relative file', () => {
    const tree = groupFilesByProject(
      ['src/Backend/Api/Weather.cs'],
      [{ name: 'Backend', path: 'src/Backend' }],
    )
    const group = tree[0]
    // Walk into Api folder → Weather.cs
    const api = group.children[0]
    expect(api.kind === 'folder' ? api.name : '').toBe('Api')
    const weather = api.kind === 'folder' ? api.children[0] : null
    expect(weather?.kind).toBe('file')
    if (weather?.kind === 'file') {
      expect(weather.fullPath).toBe('src/Backend/Api/Weather.cs')
      expect(weather.name).toBe('Weather.cs')
    }
  })

  it('longest-prefix wins when one project path nests under another', () => {
    const tree = groupFilesByProject(
      ['src/app/admin/Settings.cs'],
      [
        { name: 'App', path: 'src/app' },
        { name: 'Admin', path: 'src/app/admin' },
      ],
    )
    expect(tree).toHaveLength(1)
    expect((tree[0] as { name: string }).name).toBe('Admin')
  })
})
