import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  Folder,
  FolderOpen,
  PanelLeftClose,
} from 'lucide-react'
import { useAppStore } from '@/state/store'
import { useVisibleFiles } from '@/hooks/useRenderedFile'
import { usePickAndOpenProject } from '@/hooks/useProjectLoader'

type TreeNode =
  | { kind: 'file'; name: string; path: string }
  | { kind: 'folder'; name: string; path: string; children: TreeNode[] }

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const p of paths) {
    const parts = p.split('/')
    let level = root
    let acc = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      acc = acc ? `${acc}/${part}` : part
      const isFile = i === parts.length - 1
      const existing = level.find((n) => n.name === part)
      if (existing && existing.kind === 'folder' && !isFile) {
        level = existing.children
        continue
      }
      if (existing) continue
      if (isFile) {
        level.push({ kind: 'file', name: part, path: p })
      } else {
        const folder: TreeNode = { kind: 'folder', name: part, path: acc, children: [] }
        level.push(folder)
        level = folder.children
      }
    }
  }
  return sortTree(root)
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .map((n) => (n.kind === 'folder' ? { ...n, children: sortTree(n.children) } : n))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

function collectFolderPaths(nodes: TreeNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.kind === 'folder') {
      acc.push(n.path)
      collectFolderPaths(n.children, acc)
    }
  }
  return acc
}

function FileGlyph({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const codeLike = new Set([
    'ts',
    'tsx',
    'js',
    'jsx',
    'cs',
    'rs',
    'py',
    'go',
    'java',
    'rb',
    'php',
    'swift',
    'kt',
    'cpp',
    'c',
    'h',
    'hpp',
    'razor',
    'cshtml',
    'vue',
    'svelte',
  ])
  const Icon = codeLike.has(ext) ? FileCode : File
  return <Icon className="size-5 shrink-0 text-app-muted" />
}

export function ExplorerTree() {
  const branch = useAppStore((s) =>
    s.project?.branches.find((b) => b.name === s.currentBranchName),
  )
  const activeFile = useAppStore((s) => s.activeFile)
  const openFile = useAppStore((s) => s.openFile)
  const setPreferences = useAppStore((s) => s.setPreferences)
  const visibleFiles = useVisibleFiles()
  const pickAndOpen = usePickAndOpenProject()

  const tree = useMemo(() => buildTree(visibleFiles), [visibleFiles])

  // Default: all folders expanded.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectFolderPaths(tree)),
  )

  // When the branch changes, expand any newly-revealed folders by default
  // (existing collapse state is preserved for folders that were already there).
  useEffect(() => {
    setExpanded((prev) => {
      const all = collectFolderPaths(tree)
      const next = new Set(prev)
      for (const p of all) if (!next.has(p)) next.add(p)
      return next
    })
  }, [tree])

  if (!branch) {
    return <div className="p-3 text-xs text-app-muted">No project loaded</div>
  }

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  return (
    <nav className="flex h-full flex-col text-base">
      <div className="flex shrink-0 items-center justify-between pl-3 pr-1 pt-2 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-app-muted">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => pickAndOpen()}
            title="Open project folder"
            aria-label="Open project folder"
            className="grid size-8 place-items-center rounded text-app-muted hover:bg-app-panel hover:text-app"
          >
            <FolderOpen className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setPreferences({ explorerCollapsed: true })}
            title="Hide explorer (Ctrl+E)"
            aria-label="Hide explorer"
            className="grid size-8 place-items-center rounded text-app-muted hover:bg-app-panel hover:text-app"
          >
            <PanelLeftClose className="size-5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <ul>
          {tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              activeFile={activeFile}
              onOpen={openFile}
              onToggleFolder={toggle}
            />
          ))}
        </ul>
      </div>
    </nav>
  )
}

function TreeItem({
  node,
  depth,
  expanded,
  activeFile,
  onOpen,
  onToggleFolder,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  activeFile: string | null
  onOpen: (path: string) => void
  onToggleFolder: (path: string) => void
}) {
  const indentPx = 6 + depth * 16

  if (node.kind === 'folder') {
    const isOpen = expanded.has(node.path)
    const Chevron = isOpen ? ChevronDown : ChevronRight
    const FolderIcon = isOpen ? FolderOpen : Folder
    return (
      <li>
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          style={{ paddingLeft: indentPx }}
          className="flex w-full items-center gap-2 py-1 pr-2 text-left text-app-muted hover:bg-app-panel/60 hover:text-app"
        >
          <Chevron className="size-5 shrink-0" />
          <FolderIcon className="size-5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && (
          <ul>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                activeFile={activeFile}
                onOpen={onOpen}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const isActive = activeFile === node.path
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(node.path)}
        style={{ paddingLeft: indentPx + 28 /* align past chevron */ }}
        className={`flex w-full items-center gap-2 py-1 pr-2 text-left transition-colors ${
          isActive
            ? 'bg-app-panel text-app'
            : 'text-app-muted hover:bg-app-panel/60 hover:text-app'
        }`}
      >
        <FileGlyph name={node.name} />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  )
}
