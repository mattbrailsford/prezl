import type { ProjectFolder } from '@/types'

export type TreeFileNode = {
  kind: 'file'
  name: string
  /** Absolute (project-root-relative) file path — what the editor opens. */
  fullPath: string
}

export type TreeFolderNode = {
  kind: 'folder'
  name: string
  /** Group-scoped key, unique across the whole explorer tree. */
  key: string
  children: TreeNode[]
}

export type TreeNode = TreeFileNode | TreeFolderNode

export type TreeProjectGroup = {
  kind: 'project'
  name: string
  iconKey: string | undefined
  colorKey: string | undefined
  key: string
  children: TreeNode[]
}

export type TreeCatchAll = {
  kind: 'catch-all'
  key: '__catchall__'
  children: TreeNode[]
}

export type GroupedTree = Array<TreeProjectGroup | TreeCatchAll>

/**
 * Route each file to the declared project whose `path` is the longest prefix
 * of the file's path, and build per-group sub-trees. When `projects` is
 * undefined or empty, every file goes under a single catch-all group (which
 * the explorer can render inline with no group header).
 *
 * Empty groups (no visible files) are dropped from the result.
 */
export function groupFilesByProject(
  files: string[],
  projects: ProjectFolder[] | undefined,
): GroupedTree {
  if (!projects || projects.length === 0) {
    if (files.length === 0) return []
    return [
      {
        kind: 'catch-all',
        key: '__catchall__',
        children: buildSubtree(
          files.map((p) => ({ rel: p, full: p })),
          '__catchall__',
        ),
      },
    ]
  }

  const buckets: { rel: string; full: string }[][] = projects.map(() => [])
  const unmatched: { rel: string; full: string }[] = []

  for (const path of files) {
    const idx = routeToProject(path, projects)
    if (idx === null) {
      unmatched.push({ rel: path, full: path })
      continue
    }
    const rel = relativize(path, projects[idx].path)
    buckets[idx].push({ rel, full: path })
  }

  const groups: GroupedTree = []
  for (let i = 0; i < projects.length; i++) {
    if (buckets[i].length === 0) continue
    const key = `proj:${i}:${projects[i].name}`
    groups.push({
      kind: 'project',
      name: projects[i].name,
      iconKey: projects[i].icon,
      colorKey: projects[i].color,
      key,
      children: buildSubtree(buckets[i], key),
    })
  }
  if (unmatched.length > 0) {
    groups.push({
      kind: 'catch-all',
      key: '__catchall__',
      children: buildSubtree(unmatched, '__catchall__'),
    })
  }
  return groups
}

function routeToProject(path: string, projects: ProjectFolder[]): number | null {
  let best: number | null = null
  let bestLen = -1
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i].path.replace(/\/+$/, '')
    if (path === p || path.startsWith(`${p}/`)) {
      if (p.length > bestLen) {
        best = i
        bestLen = p.length
      }
    }
  }
  return best
}

function relativize(fullPath: string, projectPath: string): string {
  const p = projectPath.replace(/\/+$/, '')
  if (fullPath === p) return ''
  return fullPath.slice(p.length + 1)
}

function buildSubtree(
  items: { rel: string; full: string }[],
  groupKey: string,
): TreeNode[] {
  const root: TreeNode[] = []
  for (const { rel, full } of items) {
    if (rel === '') continue
    const parts = rel.split('/')
    let level = root
    let acc = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      if (!isFile) acc = acc ? `${acc}/${part}` : part
      const existing = level.find((n) => n.name === part)
      if (existing) {
        if (existing.kind === 'folder' && !isFile) {
          level = existing.children
        }
        continue
      }
      if (isFile) {
        level.push({ kind: 'file', name: part, fullPath: full })
      } else {
        const folder: TreeFolderNode = {
          kind: 'folder',
          name: part,
          key: `${groupKey}:${acc}`,
          children: [],
        }
        level.push(folder)
        level = folder.children
      }
    }
  }
  return sortTree(root)
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .map((n) =>
      n.kind === 'folder' ? { ...n, children: sortTree(n.children) } : n,
    )
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

/** Collect every folder key in a grouped tree, for seeding expand state. */
export function collectFolderKeys(
  tree: GroupedTree | TreeNode[],
  acc: string[] = [],
): string[] {
  const items = Array.isArray(tree) ? tree : []
  for (const node of items) {
    if ('kind' in node) {
      if (node.kind === 'folder') {
        acc.push(node.key)
        collectFolderKeys(node.children, acc)
      } else if (node.kind === 'project' || node.kind === 'catch-all') {
        collectFolderKeys(node.children, acc)
      }
    }
  }
  return acc
}

/**
 * Walk the grouped tree to find `filePath` and return the chain of folder
 * keys leading down to it (group → … → leaf's parent). Returns [] if the
 * file isn't present (or is a top-level child of its group).
 */
export function ancestorFolderKeysForFile(
  filePath: string,
  tree: GroupedTree,
): string[] {
  for (const group of tree) {
    const found = walkForFile(group.children, filePath)
    if (found) return found
  }
  return []
}

function walkForFile(nodes: TreeNode[], filePath: string): string[] | null {
  for (const node of nodes) {
    if (node.kind === 'file') {
      if (node.fullPath === filePath) return []
      continue
    }
    const sub = walkForFile(node.children, filePath)
    if (sub) return [node.key, ...sub]
  }
  return null
}
