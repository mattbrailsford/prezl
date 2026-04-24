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

type Palette = {
  border: string
  headerBg: string
  headerHoverBg: string
  tileBg: string
  text: string
}

// Literal Tailwind classes so the JIT scanner picks them up.
const PROJECT_PALETTE: Record<string, Palette> = {
  violet: {
    border: 'border-violet-400',
    headerBg: 'bg-violet-400/5',
    headerHoverBg: 'hover:bg-violet-400/10',
    tileBg: 'bg-violet-400/20',
    text: 'text-violet-400',
  },
  sky: {
    border: 'border-sky-400',
    headerBg: 'bg-sky-400/5',
    headerHoverBg: 'hover:bg-sky-400/10',
    tileBg: 'bg-sky-400/20',
    text: 'text-sky-400',
  },
  yellow: {
    border: 'border-yellow-300',
    headerBg: 'bg-yellow-300/5',
    headerHoverBg: 'hover:bg-yellow-300/10',
    tileBg: 'bg-yellow-300/20',
    text: 'text-yellow-300',
  },
  orange: {
    border: 'border-orange-400',
    headerBg: 'bg-orange-400/5',
    headerHoverBg: 'hover:bg-orange-400/10',
    tileBg: 'bg-orange-400/20',
    text: 'text-orange-400',
  },
  emerald: {
    border: 'border-emerald-400',
    headerBg: 'bg-emerald-400/5',
    headerHoverBg: 'hover:bg-emerald-400/10',
    tileBg: 'bg-emerald-400/20',
    text: 'text-emerald-400',
  },
  cyan: {
    border: 'border-cyan-400',
    headerBg: 'bg-cyan-400/5',
    headerHoverBg: 'hover:bg-cyan-400/10',
    tileBg: 'bg-cyan-400/20',
    text: 'text-cyan-400',
  },
  red: {
    border: 'border-red-400',
    headerBg: 'bg-red-400/5',
    headerHoverBg: 'hover:bg-red-400/10',
    tileBg: 'bg-red-400/20',
    text: 'text-red-400',
  },
  indigo: {
    border: 'border-indigo-400',
    headerBg: 'bg-indigo-400/5',
    headerHoverBg: 'hover:bg-indigo-400/10',
    tileBg: 'bg-indigo-400/20',
    text: 'text-indigo-400',
  },
  pink: {
    border: 'border-pink-400',
    headerBg: 'bg-pink-400/5',
    headerHoverBg: 'hover:bg-pink-400/10',
    tileBg: 'bg-pink-400/20',
    text: 'text-pink-400',
  },
  amber: {
    border: 'border-amber-400',
    headerBg: 'bg-amber-400/5',
    headerHoverBg: 'hover:bg-amber-400/10',
    tileBg: 'bg-amber-400/20',
    text: 'text-amber-400',
  },
  slate: {
    border: 'border-slate-400',
    headerBg: 'bg-slate-400/5',
    headerHoverBg: 'hover:bg-slate-400/10',
    tileBg: 'bg-slate-400/20',
    text: 'text-slate-400',
  },
}

// Icon → default color family. Explicit `color:` in YAML wins when provided.
const ICON_TO_COLOR: Record<string, keyof typeof PROJECT_PALETTE> = {
  dotnet: 'violet',
  csharp: 'violet',
  typescript: 'sky',
  ts: 'sky',
  javascript: 'yellow',
  js: 'yellow',
  rust: 'orange',
  rs: 'orange',
  python: 'emerald',
  py: 'emerald',
  go: 'cyan',
  java: 'red',
  kotlin: 'orange',
  kt: 'orange',
  swift: 'orange',
  ruby: 'red',
  rb: 'red',
  php: 'indigo',
  vue: 'emerald',
  svelte: 'orange',
  html: 'orange',
}

// Fallback palette uses the existing --color-project-accent CSS variable.
const FALLBACK_PALETTE: Palette = {
  border: 'border-project-accent',
  headerBg: 'bg-project-accent/5',
  headerHoverBg: 'hover:bg-project-accent/10',
  tileBg: 'bg-project-accent/20',
  text: 'text-project-accent',
}

function resolvePalette(
  iconKey: string | undefined,
  colorKey: string | undefined,
): Palette {
  const explicit = colorKey?.toLowerCase()
  if (explicit && PROJECT_PALETTE[explicit]) return PROJECT_PALETTE[explicit]
  const iconFamily = ICON_TO_COLOR[iconKey?.toLowerCase() ?? '']
  if (iconFamily) return PROJECT_PALETTE[iconFamily]
  return FALLBACK_PALETTE
}

/** Tiny icon map for the `projects[].icon` hint. Fallback is a generic box. */
function ProjectGlyph({
  iconKey,
  palette,
}: {
  iconKey: string | undefined
  palette: Palette
}) {
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
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-sm ${palette.tileBg} font-mono text-[0.625rem] font-bold ${palette.text}`}
      >
        {label}
      </span>
    )
  }
  return <Box className={`size-5 shrink-0 ${palette.text}`} />
}

// Extension → (is-code, Tailwind color class) lookup. Colors loosely follow
// IDE file-icon conventions so the tree reads at-a-glance. Unknown types
// fall through to a muted generic file icon.
const FILE_STYLES: Record<string, { code: boolean; color: string }> = {
  // JS/TS
  ts: { code: true, color: 'text-sky-400' },
  tsx: { code: true, color: 'text-sky-400' },
  js: { code: true, color: 'text-yellow-300' },
  jsx: { code: true, color: 'text-yellow-300' },
  mjs: { code: true, color: 'text-yellow-300' },
  cjs: { code: true, color: 'text-yellow-300' },
  // .NET
  cs: { code: true, color: 'text-violet-400' },
  razor: { code: true, color: 'text-violet-300' },
  cshtml: { code: true, color: 'text-violet-300' },
  // Rust / Go / systems
  rs: { code: true, color: 'text-orange-400' },
  go: { code: true, color: 'text-cyan-400' },
  c: { code: true, color: 'text-blue-500' },
  h: { code: true, color: 'text-blue-500' },
  cpp: { code: true, color: 'text-blue-500' },
  hpp: { code: true, color: 'text-blue-500' },
  // JVM / friends
  java: { code: true, color: 'text-red-400' },
  kt: { code: true, color: 'text-orange-400' },
  swift: { code: true, color: 'text-orange-500' },
  // Script
  py: { code: true, color: 'text-emerald-400' },
  rb: { code: true, color: 'text-red-500' },
  php: { code: true, color: 'text-indigo-400' },
  sh: { code: true, color: 'text-green-300' },
  bash: { code: true, color: 'text-green-300' },
  // Frameworks / UI
  vue: { code: true, color: 'text-emerald-400' },
  svelte: { code: true, color: 'text-orange-500' },
  // Styling
  css: { code: false, color: 'text-pink-400' },
  scss: { code: false, color: 'text-pink-500' },
  sass: { code: false, color: 'text-pink-500' },
  less: { code: false, color: 'text-pink-400' },
  // Markup / config
  html: { code: false, color: 'text-orange-400' },
  xml: { code: false, color: 'text-orange-300' },
  json: { code: false, color: 'text-yellow-400' },
  yaml: { code: false, color: 'text-red-400' },
  yml: { code: false, color: 'text-red-400' },
  toml: { code: false, color: 'text-amber-400' },
  md: { code: false, color: 'text-sky-300' },
  mdx: { code: false, color: 'text-sky-300' },
  sql: { code: false, color: 'text-orange-300' },
}

function FileGlyph({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const style = FILE_STYLES[ext]
  const Icon = style?.code ? FileCode : File
  const color = style?.color ?? 'text-app-muted'
  return <Icon className={`size-5 shrink-0 ${color}`} />
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
                {group.kind === 'project' ? (() => {
                  const palette = resolvePalette(group.iconKey, group.colorKey)
                  return (
                    <button
                      type="button"
                      onClick={() => toggle(group.key)}
                      className={`flex w-full items-center gap-2 border-l-2 py-1.5 pl-2 pr-2 text-left ${palette.border} ${palette.headerBg} ${palette.headerHoverBg}`}
                    >
                      <Chevron className="size-5 shrink-0 text-app-muted" />
                      <ProjectGlyph iconKey={group.iconKey} palette={palette} />
                      <span className="truncate font-semibold text-app">
                        {group.name}
                      </span>
                    </button>
                  )
                })() : (
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    className="flex w-full items-center gap-2 border-l-2 border-transparent py-1 pl-2 pr-2 text-left text-xs font-semibold uppercase tracking-wider text-app-muted hover:text-app"
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
