import { create } from 'zustand'
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type PrezlProject,
  type PreviewState,
  type Screen,
} from '@/types'
import { reconcileScreenSwitch } from './stageReducer'
import { buildScreenIndex, type ScreenIndex } from '@/project/stageList'
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
  /** Cached screen index built once per project load. Null when no project. */
  screenIndex: ScreenIndex | null
  currentScreenId: string | null
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
  /** When true, render BootCurtain over everything else. Used to hide any
   *  flash between WelcomeScreen / recent auto-open / deep-link routing
   *  during cold start, and to mask transitions when a runtime deep link
   *  swaps projects mid-presentation. */
  isRouting: boolean
  /** True when the active project was opened by a deep link with
   *  `hideOnExit=1`. Surfaces the "Back to presentation" button + shortcut.
   *  Cleared on clearProject. */
  launchedFromSlide: boolean
}

type AppActions = {
  setProject: (
    project: PrezlProject,
    rawFiles: Map<string, string>,
    initialStageAlias?: string,
  ) => void
  clearProject: () => void
  /** Jump to the first screen of a stage (the stage selector calls this). */
  switchStage: (alias: string) => void
  /** Jump to a specific screen by full id ("shell" or "shell.intro"). */
  switchScreen: (id: string) => void
  /** Walk the flat ordered screen list — stage shortcuts call this. */
  switchScreenRelative: (delta: 1 | -1) => void
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
  setIsRouting: (v: boolean) => void
  setLaunchedFromSlide: (v: boolean) => void
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  project: null,
  rawFiles: new Map(),
  screenIndex: null,
  currentScreenId: null,
  openTabs: [],
  activeFile: null,
  statusMessage: 'Ready',
  previewState: { kind: 'closed' },
  preferences: DEFAULT_PREFERENCES,
  loading: false,
  loadError: null,
  pendingNavigation: null,
  symbolFinderOpen: false,
  isRouting: true,
  launchedFromSlide: false,

  setProject: (project, rawFiles, initialStageAlias) => {
    const screenIndex = buildScreenIndex(project.stages)
    const initialScreen: Screen | null =
      (initialStageAlias
        ? firstScreenOfStage(screenIndex, initialStageAlias)
        : null) ??
      screenIndex.ordered[0] ??
      null
    const visibleFiles = initialScreen
      ? computeVisibleFiles({
          files: project.files,
          rawFiles,
          currentScreenId: initialScreen.id,
          screenIndex,
        })
      : []
    const intended = initialScreen?.open?.file
    const firstFile =
      intended && visibleFiles.includes(intended)
        ? intended
        : (visibleFiles[0] ?? null)
    set({
      project,
      rawFiles,
      screenIndex,
      currentScreenId: initialScreen?.id ?? null,
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
      screenIndex: null,
      currentScreenId: null,
      openTabs: [],
      activeFile: null,
      statusMessage: 'Ready',
      previewState: { kind: 'closed' },
      loadError: null,
      launchedFromSlide: false,
    }),

  switchStage: (alias) => {
    const state = get()
    if (!state.screenIndex) return
    const first = firstScreenOfStage(state.screenIndex, alias)
    if (!first) return
    get().switchScreen(first.id)
  },

  switchScreen: (id) => {
    const state = get()
    const project = state.project
    const screenIndex = state.screenIndex
    if (!project || !screenIndex) return
    const target = screenIndex.byId[id]
    if (!target) return

    const previous = state.currentScreenId
      ? (screenIndex.byId[state.currentScreenId] ?? null)
      : null
    const crossingStage = previous?.stageAlias !== target.stageAlias

    if (crossingStage) {
      const stage = project.stages.find((s) => s.alias === target.stageAlias)
      const label = stage?.branch ?? stage?.title ?? target.stageAlias
      set({ statusMessage: `Switching to ${label}...` })
    }

    const visibleFiles = computeVisibleFiles({
      files: project.files,
      rawFiles: state.rawFiles,
      currentScreenId: target.id,
      screenIndex,
    })
    const next = reconcileScreenSwitch({
      screen: target,
      visibleFiles,
      openTabs: state.openTabs,
      activeFile: state.activeFile,
    })
    set({
      currentScreenId: target.id,
      openTabs: next.openTabs,
      activeFile: next.activeFile,
    })
    if (crossingStage) {
      window.setTimeout(() => {
        if (get().currentScreenId === target.id) {
          set({ statusMessage: 'Ready' })
        }
      }, 400)
    }
  },

  switchScreenRelative: (delta) => {
    const state = get()
    if (!state.screenIndex || !state.currentScreenId) return
    const ordered = state.screenIndex.ordered
    const idx = ordered.findIndex((s) => s.id === state.currentScreenId)
    if (idx < 0) return
    const next = ordered[idx + delta]
    if (!next) return
    get().switchScreen(next.id)
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
    const screen =
      state.screenIndex && state.currentScreenId
        ? (state.screenIndex.byId[state.currentScreenId] ?? null)
        : null
    const preview = screen?.preview
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
  setIsRouting: (v) => set({ isRouting: v }),
  setLaunchedFromSlide: (v) => set({ launchedFromSlide: v }),
}))

function firstScreenOfStage(
  screenIndex: ScreenIndex,
  alias: string,
): Screen | null {
  const bounds = screenIndex.byStage[alias]
  if (!bounds) return null
  return bounds.screens[0] ?? null
}
