import { create } from 'zustand'
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type PrezlProject,
  type PreviewState,
} from '@/types'
import { reconcileStageSwitch } from './stageReducer'
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
  currentStageAlias: string | null
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
    initialStageAlias?: string,
  ) => void
  clearProject: () => void
  switchStage: (alias: string) => void
  switchStageRelative: (delta: 1 | -1) => void
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
  currentStageAlias: null,
  openTabs: [],
  activeFile: null,
  statusMessage: 'Ready',
  previewState: { kind: 'closed' },
  preferences: DEFAULT_PREFERENCES,
  loading: false,
  loadError: null,
  pendingNavigation: null,
  symbolFinderOpen: false,

  setProject: (project, rawFiles, initialStageAlias) => {
    const stage =
      project.stages.find((s) => s.alias === initialStageAlias) ??
      [...project.stages].sort((a, b) => a.order - b.order)[0]
    const stageIndex = buildStageIndex(project.stages)
    const visibleFiles = stage
      ? computeVisibleFiles({
          files: project.files,
          rawFiles,
          currentStageAlias: stage.alias,
          stageIndex,
        })
      : []
    const intended = stage?.open?.file
    const firstFile =
      intended && visibleFiles.includes(intended)
        ? intended
        : (visibleFiles[0] ?? null)
    set({
      project,
      rawFiles,
      currentStageAlias: stage?.alias ?? null,
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
      currentStageAlias: null,
      openTabs: [],
      activeFile: null,
      statusMessage: 'Ready',
      previewState: { kind: 'closed' },
      loadError: null,
    }),

  switchStage: (alias) => {
    const state = get()
    const project = state.project
    if (!project) return
    const target = project.stages.find((s) => s.alias === alias)
    if (!target) return

    const label = target.branch ?? target.title ?? target.alias
    set({ statusMessage: `Switching to ${label}...` })
    const stageIndex = buildStageIndex(project.stages)
    const visibleFiles = computeVisibleFiles({
      files: project.files,
      rawFiles: state.rawFiles,
      currentStageAlias: target.alias,
      stageIndex,
    })
    const next = reconcileStageSwitch({
      stage: target,
      visibleFiles,
      openTabs: state.openTabs,
      activeFile: state.activeFile,
    })
    set({
      currentStageAlias: target.alias,
      openTabs: next.openTabs,
      activeFile: next.activeFile,
    })
    window.setTimeout(() => {
      if (get().currentStageAlias === target.alias) {
        set({ statusMessage: 'Ready' })
      }
    }, 400)
  },

  switchStageRelative: (delta) => {
    const state = get()
    if (!state.project) return
    const ordered = [...state.project.stages].sort((a, b) => a.order - b.order)
    const idx = ordered.findIndex((s) => s.alias === state.currentStageAlias)
    if (idx < 0) return
    const next = ordered[idx + delta]
    if (!next) return
    get().switchStage(next.alias)
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
    const stage = state.project?.stages.find(
      (s) => s.alias === state.currentStageAlias,
    )
    const preview = stage?.preview
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
