import { create } from 'zustand'
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type Preview,
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

/** Where the user was looking — pushed onto the back/forward stack on every
 *  user-initiated navigation that changes (screenId, activeFile). */
type HistoryLocation = {
  screenId: string
  file: string | null
}

/** Per-(screen, file) scroll positions for back/forward restore. Mutated in
 *  place from the code viewer's onScroll handler — never observed reactively,
 *  so it lives outside Zustand state to avoid spurious re-renders. */
const scrollPositions = new Map<string, number>()

function scrollKey(screenId: string, file: string | null): string {
  return `${screenId}::${file ?? ''}`
}

export function saveScrollPosition(
  screenId: string,
  file: string | null,
  top: number,
): void {
  scrollPositions.set(scrollKey(screenId, file), top)
}

function getScrollPosition(
  screenId: string,
  file: string | null,
): number | null {
  return scrollPositions.get(scrollKey(screenId, file)) ?? null
}

/** Set during goBack/goForward replay so the inner switchScreen / openFile /
 *  setActiveFile path doesn't push a duplicate history entry. Closure-scoped
 *  rather than store-scoped because no UI ever needs to read it. */
let suppressHistoryPush = false

function pushHistoryEntry(
  state: { history: HistoryLocation[]; historyIndex: number },
  loc: HistoryLocation,
): { history: HistoryLocation[]; historyIndex: number } | null {
  const top = state.history[state.historyIndex]
  if (top && top.screenId === loc.screenId && top.file === loc.file) return null
  const truncated = state.history.slice(0, state.historyIndex + 1)
  truncated.push(loc)
  return { history: truncated, historyIndex: truncated.length - 1 }
}

/**
 * Decide whether moving from `previousScreen` to `targetScreen` should fire
 * a video preview's `autoLaunch: 'start'` (the lead-with-video pattern).
 * Three conditions must all hold:
 *
 *   1. The target's preview is a video with `autoLaunch: 'start'`.
 *   2. The target's preview object reference differs from the previous
 *      screen's — `buildScreenIndex` reuses the same reference when a step
 *      inherits its preview, so equal references mean "no authorial change",
 *      which is exactly when we want to suppress re-firing.
 *   3. We're moving forward (or it's the first screen). Going backward
 *      through a deck shouldn't replay the intro video.
 */
function shouldAutoLaunchOnEnter(
  previousScreen: Screen | null,
  targetScreen: Screen,
): targetScreen is Screen & { preview: Preview & { type: 'video' } } {
  const preview = targetScreen.preview
  if (preview?.type !== 'video' || preview.autoLaunch !== 'start') return false
  if (previousScreen?.preview === preview) return false
  if (previousScreen && targetScreen.order <= previousScreen.order) return false
  return true
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
  /** Browser-style back/forward stack of (screenId, file) locations.
   *  Pushed on user-initiated navigation; replayed by goBack/goForward. */
  history: HistoryLocation[]
  historyIndex: number
  /** One-shot scroll-pixel target consumed by CodeView, set when goBack/
   *  goForward restores a previously visited location. */
  pendingScrollTop: number | null
  /** Screen id whose `autoLaunch: 'end'` video has already been played in
   *  this session. Re-traversing the same screen (back-then-forward, or
   *  via the stage dropdown) won't replay it. Reset on project (re)load. */
  lastEndAutoLaunchedScreenId: string | null
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
  /** Walk back / forward through the location history. No-op at boundaries. */
  goBack: () => void
  goForward: () => void
  consumePendingScrollTop: () => void
}

export const useAppStore = create<AppState & AppActions>((set, get) => {
  // Helpers closed over set/get. Defined here so the actions below can call
  // them without threading parameters through every call site.

  const recordCurrent = (): void => {
    if (suppressHistoryPush) return
    const s = get()
    if (!s.currentScreenId) return
    const next = pushHistoryEntry(s, {
      screenId: s.currentScreenId,
      file: s.activeFile,
    })
    if (next) set(next)
  }

  /** Apply a history entry to the store without pushing back onto the stack.
   *  Mirrors the visible-files / tab-reconcile work of switchScreen, but
   *  forces activeFile to the recorded file (overriding screen.open's intent
   *  — the user explicitly asked to go back to *this* file) and skips the
   *  video-preview autoLaunch (going back shouldn't replay a video). */
  const applyHistoryLocation = (loc: HistoryLocation): void => {
    const state = get()
    const project = state.project
    const screenIndex = state.screenIndex
    if (!project || !screenIndex) return
    const target = screenIndex.byId[loc.screenId]
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
    const visible = new Set(visibleFiles)
    let openTabs = state.openTabs.filter((p) => visible.has(p))
    let activeFile: string | null =
      loc.file && visible.has(loc.file) ? loc.file : null
    if (activeFile && !openTabs.includes(activeFile)) {
      openTabs = [...openTabs, activeFile]
    }
    if (!activeFile && openTabs.length > 0) {
      activeFile = openTabs[openTabs.length - 1]!
    } else if (!activeFile && visibleFiles.length > 0) {
      activeFile = visibleFiles[0]!
      openTabs = [activeFile]
    }

    set({
      currentScreenId: target.id,
      openTabs,
      activeFile,
      pendingScrollTop: getScrollPosition(target.id, activeFile),
    })

    if (crossingStage) {
      window.setTimeout(() => {
        if (get().currentScreenId === target.id) {
          set({ statusMessage: 'Ready' })
        }
      }, 400)
    }
  }

  return {
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
  history: [],
  historyIndex: -1,
  pendingScrollTop: null,
  lastEndAutoLaunchedScreenId: null,

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
    // Always reset previewState on project load so a stale modal from a
    // previous project never bleeds through. If the initial screen carries
    // an autoLaunch video, open it directly here — switchScreen isn't
    // called for the initial screen, so its autolaunch hook wouldn't fire
    // on cold start.
    let previewState: PreviewState = { kind: 'closed' }
    if (initialScreen && shouldAutoLaunchOnEnter(null, initialScreen)) {
      previewState = { kind: 'video', preview: initialScreen.preview }
    }
    scrollPositions.clear()
    const initialHistory: HistoryLocation[] = initialScreen
      ? [{ screenId: initialScreen.id, file: firstFile }]
      : []
    set({
      project,
      rawFiles,
      screenIndex,
      currentScreenId: initialScreen?.id ?? null,
      openTabs: firstFile ? [firstFile] : [],
      activeFile: firstFile,
      statusMessage: 'Ready',
      previewState,
      loadError: null,
      history: initialHistory,
      historyIndex: initialHistory.length - 1,
      pendingScrollTop: null,
      lastEndAutoLaunchedScreenId: null,
    })
  },

  clearProject: () => {
    scrollPositions.clear()
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
      history: [],
      historyIndex: -1,
      pendingScrollTop: null,
      lastEndAutoLaunchedScreenId: null,
    })
  },

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
    // Don't stomp on an already-open preview (rare — modal absorbs Space —
    // but defensive against stage-dropdown jumps mid-modal).
    if (
      get().previewState.kind === 'closed' &&
      shouldAutoLaunchOnEnter(previous, target)
    ) {
      set({ previewState: { kind: 'video', preview: target.preview } })
    }
    if (crossingStage) {
      window.setTimeout(() => {
        if (get().currentScreenId === target.id) {
          set({ statusMessage: 'Ready' })
        }
      }, 400)
    }
    recordCurrent()
  },

  switchScreenRelative: (delta) => {
    const state = get()
    if (!state.screenIndex || !state.currentScreenId) return
    const ordered = state.screenIndex.ordered
    const idx = ordered.findIndex((s) => s.id === state.currentScreenId)
    if (idx < 0) return
    // Trail-with-video: forward-leaving a screen with `autoLaunch: 'end'`
    // opens its video first instead of advancing. Fires only when leaving
    // the preview's *scope* — i.e., the next screen has a different
    // preview, or we're at the end of the deck. Sticky-inheritance gives
    // every step inside a stage the same preview reference, so without
    // this guard a stage-level trailing video would re-fire on every step
    // forward-advance. lastEndAutoLaunchedScreenId then suppresses the
    // re-fire on the immediate "advance after watching" press. Stays
    // inert when a modal is already up — defensive against rapid input.
    if (delta === 1 && state.previewState.kind === 'closed') {
      const current = ordered[idx]
      const next = ordered[idx + 1] ?? null
      const preview = current?.preview
      const leavingPreviewScope = !next || next.preview !== preview
      if (
        preview?.type === 'video' &&
        preview.autoLaunch === 'end' &&
        leavingPreviewScope &&
        state.lastEndAutoLaunchedScreenId !== current.id
      ) {
        set({
          previewState: { kind: 'video', preview, trailing: true },
          lastEndAutoLaunchedScreenId: current.id,
        })
        return
      }
    }
    const next = ordered[idx + delta]
    if (!next) return
    get().switchScreen(next.id)
  },

  openFile: (path) => {
    set((s) => ({
      openTabs: s.openTabs.includes(path) ? s.openTabs : [...s.openTabs, path],
      activeFile: path,
    }))
    recordCurrent()
  },

  closeTab: (path) =>
    set((s) => {
      const openTabs = s.openTabs.filter((p) => p !== path)
      const activeFile =
        s.activeFile === path ? (openTabs[openTabs.length - 1] ?? null) : s.activeFile
      return { openTabs, activeFile }
    }),

  setActiveFile: (path) => {
    set({ activeFile: path })
    recordCurrent()
  },

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
    recordCurrent()
  },

  consumePendingNavigation: () => set({ pendingNavigation: null }),
  openSymbolFinder: () => set({ symbolFinderOpen: true }),
  closeSymbolFinder: () => set({ symbolFinderOpen: false }),
  setIsRouting: (v) => set({ isRouting: v }),
  setLaunchedFromSlide: (v) => set({ launchedFromSlide: v }),

  goBack: () => {
    const state = get()
    if (state.historyIndex <= 0) return
    const targetIdx = state.historyIndex - 1
    const loc = state.history[targetIdx]
    if (!loc) return
    suppressHistoryPush = true
    try {
      set({ historyIndex: targetIdx })
      applyHistoryLocation(loc)
    } finally {
      suppressHistoryPush = false
    }
  },

  goForward: () => {
    const state = get()
    if (state.historyIndex >= state.history.length - 1) return
    const targetIdx = state.historyIndex + 1
    const loc = state.history[targetIdx]
    if (!loc) return
    suppressHistoryPush = true
    try {
      set({ historyIndex: targetIdx })
      applyHistoryLocation(loc)
    } finally {
      suppressHistoryPush = false
    }
  },

  consumePendingScrollTop: () => set({ pendingScrollTop: null }),
  }
})

function firstScreenOfStage(
  screenIndex: ScreenIndex,
  alias: string,
): Screen | null {
  const bounds = screenIndex.byStage[alias]
  if (!bounds) return null
  return bounds.screens[0] ?? null
}
