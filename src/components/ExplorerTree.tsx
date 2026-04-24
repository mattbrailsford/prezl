import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  Folder,
  FolderOpen,
  Hash,
  PanelLeftClose,
} from 'lucide-react'
import { useAppStore } from '@/state/store'
import { useVisibleFiles } from '@/hooks/useRenderedFile'
import { usePickAndOpenProject } from '@/hooks/useProjectLoader'
import {
  collectFolderKeys,
  groupFilesByProject,
  type TreeNode,
} from '@/project/projectTree'

/** Tiny icon map for the `projects[].icon` hint. Fallback is a generic box. */
function ProjectGlyph({ iconKey }: { iconKey: string | undefined }) {
  const label = (() => {
    switch (iconKey?.toLowerCase()) {
      case 'dotnet':
      case 'csharp':
        return 'C#'
      case 'typescript':
      case 'ts':
        return 'TS'
      case 'javascript':
      case 'js':
        return 'JS'
      case 'rust':
      case 'rs':
        return 'Rs'
      case 'python':
      case 'py':
        return 'Py'
      case 'go':
        return 'Go'
      default:
        return null
    }
  })()
  if (label) {
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-project-accent/20 font-mono text-[10px] font-bold text-project-accent">
        {label}
      </span>
    )
  }
  return <Box className="size-5 shrink-0 text-project-accent" />
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
  const project = useAppStore((s) => s.project)
  const projects = project?.projects
  const activeFile = useAppStore((s) => s.activeFile)
  const openFile = useAppStore((s) => s.openFile)
  const setPreferences = useAppStore((s) => s.setPreferences)
  const visibleFiles = useVisibleFiles()
  const pickAndOpen = usePickAndOpenProject()

  const groups = useMemo(
    () => groupFilesByProject(visibleFiles, projects),
    [visibleFiles, projects],
  )

  // Default: every folder + every project/catch-all group starts expanded.
  // Re-running on groups change adds new keys without blowing away existing
  // collapse choices.
  const allExpandableKeys = useMemo(() => {
    const keys = collectFolderKeys(groups)
    for (const g of groups) keys.push(g.key)
    return keys
  }, [groups])
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(allExpandableKeys),
  )
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const k of allExpandableKeys) if (!next.has(k)) next.add(k)
      return next
    })
  }, [allExpandableKeys])

  if (!project) {
    return <div className="p-3 text-xs text-app-muted">No project loaded</div>
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // When a single catch-all group covers everything (no projects declared),
  // skip the group-header chrome and render children directly — matches the
  // original flat-tree look for simple single-project setups.
  const renderAsFlatTree =
    groups.length === 1 && groups[0].kind === 'catch-all' && !projects?.length

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
        {renderAsFlatTree ? (
          <ul>
            {groups[0].children.map((node) => (
              <TreeItem
                key={node.kind === 'folder' ? node.key : node.fullPath}
                node={node}
                depth={0}
                expanded={expanded}
                activeFile={activeFile}
                onOpen={openFile}
                onToggleFolder={toggle}
              />
            ))}
          </ul>
        ) : (
          groups.map((group, idx) => {
            const groupOpen = expanded.has(group.key)
            const Chevron = groupOpen ? ChevronDown : ChevronRight
            return (
              <section
                key={group.key}
                className={
                  idx > 0 ? 'mt-1 border-t border-app-border/60' : undefined
                }
              >
                {group.kind === 'project' ? (
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    className="flex w-full items-center gap-2 border-l-2 border-project-accent bg-project-accent/5 py-1.5 pl-2 pr-2 text-left text-[13px] hover:bg-project-accent/10"
                  >
                    <Chevron className="size-5 shrink-0 text-app-muted" />
                    <ProjectGlyph iconKey={group.iconKey} />
                    <span className="truncate font-semibold text-app">
                      {group.name}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    className="flex w-full items-center gap-2 border-l-2 border-transparent py-1 pl-2 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-app-muted hover:text-app"
                  >
                    <Chevron className="size-5 shrink-0" />
                    <Hash className="size-4" />
                    Files
                  </button>
                )}
                {groupOpen && (
                  <ul className="pl-1">
                    {group.children.map((node) => (
                      <TreeItem
                        key={node.kind === 'folder' ? node.key : node.fullPath}
                        node={node}
                        depth={0}
                        expanded={expanded}
                        activeFile={activeFile}
                        onOpen={openFile}
                        onToggleFolder={toggle}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )
          })
        )}
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
  onToggleFolder: (key: string) => void
}) {
  const indentPx = 6 + depth * 16

  if (node.kind === 'folder') {
    const isOpen = expanded.has(node.key)
    const Chevron = isOpen ? ChevronDown : ChevronRight
    const FolderIcon = isOpen ? FolderOpen : Folder
    return (
      <li>
        <button
          type="button"
          onClick={() => onToggleFolder(node.key)}
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
                key={child.kind === 'folder' ? child.key : child.fullPath}
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

  const isActive = activeFile === node.fullPath
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(node.fullPath)}
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
