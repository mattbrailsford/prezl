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
import type { LoadError } from '@/project/schema'

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
}))
