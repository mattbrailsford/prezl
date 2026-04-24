import { create } from 'zustand'
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type PrezlProject,
  type PreviewState,
} from '@/types'
import { reconcileBranchSwitch } from './branchReducer'
import { buildStageIndex } from '@/project/stageList'
import { computeVisibleFiles } from '@/project/visibleFiles'
import { launchUrlPreview } from '@/project/previewLauncher'
import type { LoadError } from '@/project/schema'

const BUILD_DELAY_MS = 600
const LAUNCH_DELAY_MS = 300

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

type AppState = {
  project: PrezlProject | null
  rawFiles: Map<string, string>
  currentBranchName: string | null
  openTabs: string[]
  activeFile: string | null
  statusMessage: string
  previewState: PreviewState
  preferences: Preferences
  loading: boolean
  loadError: LoadError | null
  /** One-shot scroll target: after switching activeFile via navigateToFileLine,
   *  the editor consumes this and then clears it. */
  pendingNavigation: { file: string; line: number } | null
  symbolFinderOpen: boolean
}

type AppActions = {
  setProject: (
    project: PrezlProject,
    rawFiles: Map<string, string>,
    initialBranchName?: string,
  ) => void
  clearProject: () => void
  switchBranch: (name: string) => void
  switchBranchRelative: (delta: 1 | -1) => void
  openFile: (path: string) => void
  closeTab: (path: string) => void
  setActiveFile: (path: string | null) => void
  setStatusMessage: (msg: string) => void
  setPreferences: (patch: Partial<Preferences>) => void
  setLoading: (loading: boolean) => void
  setLoadError: (err: LoadError | null) => void
  runPreview: () => Promise<void>
  closePreview: () => void
  navigateToFileLine: (file: string, line: number) => void
  consumePendingNavigation: () => void
  openSymbolFinder: () => void
  closeSymbolFinder: () => void
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  project: null,
  rawFiles: new Map(),
  currentBranchName: null,
  openTabs: [],
  activeFile: null,
  statusMessage: 'Ready',
  previewState: { kind: 'closed' },
  preferences: DEFAULT_PREFERENCES,
  loading: false,
  loadError: null,
  pendingNavigation: null,
  symbolFinderOpen: false,

  setProject: (project, rawFiles, initialBranchName) => {
    const branch =
      project.branches.find((b) => b.name === initialBranchName) ??
      [...project.branches].sort((a, b) => a.order - b.order)[0]
    const stageIndex = buildStageIndex(project.branches)
    const visibleFiles = branch
      ? computeVisibleFiles({
          files: project.files,
          rawFiles,
          currentStageAlias: branch.alias,
          stageIndex,
        })
      : []
    const intended = branch?.open?.file
    const firstFile =
      intended && visibleFiles.includes(intended)
        ? intended
        : (visibleFiles[0] ?? null)
    set({
      project,
      rawFiles,
      currentBranchName: branch?.name ?? null,
      openTabs: firstFile ? [firstFile] : [],
      activeFile: firstFile,
      statusMessage: 'Ready',
      loadError: null,
    })
  },

  clearProject: () =>
    set({
      project: null,
      rawFiles: new Map(),
      currentBranchName: null,
      openTabs: [],
      activeFile: null,
      statusMessage: 'Ready',
      previewState: { kind: 'closed' },
      loadError: null,
    }),

  switchBranch: (name) => {
    const state = get()
    const project = state.project
    if (!project) return
    const target = project.branches.find((b) => b.name === name)
    if (!target) return

    set({ statusMessage: `Checking out ${name}...` })
    const stageIndex = buildStageIndex(project.branches)
    const visibleFiles = computeVisibleFiles({
      files: project.files,
      rawFiles: state.rawFiles,
      currentStageAlias: target.alias,
      stageIndex,
    })
    const next = reconcileBranchSwitch({
      branch: target,
      visibleFiles,
      openTabs: state.openTabs,
      activeFile: state.activeFile,
    })
    set({
      currentBranchName: target.name,
      openTabs: next.openTabs,
      activeFile: next.activeFile,
    })
    window.setTimeout(() => {
      if (get().currentBranchName === target.name) {
        set({ statusMessage: 'Ready' })
      }
    }, 400)
  },

  switchBranchRelative: (delta) => {
    const state = get()
    if (!state.project) return
    const ordered = [...state.project.branches].sort((a, b) => a.order - b.order)
    const idx = ordered.findIndex((b) => b.name === state.currentBranchName)
    if (idx < 0) return
    const next = ordered[idx + delta]
    if (!next) return
    get().switchBranch(next.name)
  },

  openFile: (path) =>
    set((s) => ({
      openTabs: s.openTabs.includes(path) ? s.openTabs : [...s.openTabs, path],
      activeFile: path,
    })),

  closeTab: (path) =>
    set((s) => {
      const openTabs = s.openTabs.filter((p) => p !== path)
      const activeFile =
        s.activeFile === path ? (openTabs[openTabs.length - 1] ?? null) : s.activeFile
      return { openTabs, activeFile }
    }),

  setActiveFile: (path) => set({ activeFile: path }),

  setStatusMessage: (msg) => set({ statusMessage: msg }),

  setPreferences: (patch) =>
    set((s) => ({ preferences: { ...s.preferences, ...patch } })),

  setLoading: (loading) => set({ loading }),
  setLoadError: (loadError) => set({ loadError }),

  runPreview: async () => {
    const state = get()
    const branch = state.project?.branches.find(
      (b) => b.name === state.currentBranchName,
    )
    const preview = branch?.preview
    if (!preview) {
      set({ statusMessage: 'No preview configured' })
      window.setTimeout(() => {
        if (get().statusMessage === 'No preview configured') {
          set({ statusMessage: 'Ready' })
        }
      }, 1500)
      return
    }
    if (state.previewState.kind !== 'closed') return

    set({
      previewState: { kind: 'launching', preview },
      statusMessage: 'Building...',
    })
    await sleep(BUILD_DELAY_MS)
    if (get().previewState.kind !== 'launching') return
    set({ statusMessage: 'Build succeeded' })
    await sleep(LAUNCH_DELAY_MS)
    if (get().previewState.kind !== 'launching') return
    set({ statusMessage: 'Launching preview...' })

    if (preview.type === 'url') {
      try {
        await launchUrlPreview(preview)
        set({ previewState: { kind: 'closed' }, statusMessage: 'Ready' })
      } catch (e) {
        set({
          previewState: { kind: 'closed' },
          statusMessage: `Preview failed: ${(e as Error).message}`,
        })
      }
      return
    }

    // Video preview — M5 will render a modal. Until then, route to the
    // video preview state so the Run button disables and Ctrl+Enter doesn't
    // re-trigger.
    set({
      previewState: { kind: 'video', preview },
      statusMessage: 'Ready',
    })
  },

  closePreview: () =>
    set({ previewState: { kind: 'closed' }, statusMessage: 'Ready' }),

  navigateToFileLine: (file, line) => {
    set((s) => ({
      openTabs: s.openTabs.includes(file) ? s.openTabs : [...s.openTabs, file],
      activeFile: file,
      pendingNavigation: { file, line },
    }))
  },

  consumePendingNavigation: () => set({ pendingNavigation: null }),
  openSymbolFinder: () => set({ symbolFinderOpen: true }),
  closeSymbolFinder: () => set({ symbolFinderOpen: false }),
}))
