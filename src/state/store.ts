import { create } from 'zustand'
import {
  DEFAULT_PREFERENCES,
  type CoverItem,
  type Preferences,
  type Preview,
  type PrezlProject,
  type PreviewState,
  type Screen,
  type VideoPreview,
} from '@/types'
import { applyStageEntryReset, reconcileScreenSwitch } from './stageReducer'
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

/** Find the (single by invariant) video entry in a screen's preview list
 *  that opts into a given autoLaunch mode. Returns `null` when none. */
function findAutoLaunchVideo(
  screen: Screen | null | undefined,
  mode: 'start' | 'end',
): VideoPreview | null {
  if (!screen?.previews) return null
  for (const p of screen.previews) {
    if (p.type === 'video' && p.autoLaunch === mode) return p
  }
  return null
}

/**
 * Decide whether moving from `previousScreen` to `targetScreen` should fire
 * a video preview's `autoLaunch: 'start'` (the lead-with-video pattern).
 * Returns the preview to launch, or `null`. Three conditions must all hold:
 *
 *   1. The target has a video preview entry with `autoLaunch: 'start'`.
 *   2. That entry's reference differs from the previous screen's autoStart
 *      entry — `buildScreenIndex` reuses the same list (and thus the same
 *      entry) when a step inherits its preview from the stage, so equal
 *      references mean "still in scope", which is exactly when we want to
 *      suppress re-firing.
 *   3. We're moving forward (or it's the first screen). Going backward
 *      through a deck shouldn't replay the intro video.
 */
function autoLaunchStartFor(
  previousScreen: Screen | null,
  targetScreen: Screen,
): VideoPreview | null {
  const autoStart = findAutoLaunchVideo(targetScreen, 'start')
  if (!autoStart) return null
  const prevAutoStart = findAutoLaunchVideo(previousScreen, 'start')
  if (prevAutoStart === autoStart) return null
  if (previousScreen && targetScreen.order <= previousScreen.order) return null
  return autoStart
}

type AppState = {
  project: PrezlProject | null
  rawFiles: Map<string, string>
  /** Paths the backend couldn't read as UTF-8. Listed in the explorer with a
   *  "Can't preview this file type" placeholder. */
  binaryFiles: Set<string>
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
  /** Monotonic counter incremented when a cross-stage entry triggers a
   *  stage-level `reset:` flag. ExplorerTree subscribes to this and
   *  collapses every folder outside the active file's ancestor chain on
   *  change. The store can't drive the explorer's expanded set directly —
   *  it's local component state — so a token is the lightest signal. */
  explorerResetToken: number
  /** File paths the presenter has had open since entering the current stage.
   *  Cleared on every cross-stage transition (forward, back, dropdown);
   *  added to whenever activeFile changes. The cover list reads this to mark
   *  which entries have been visited in this run through the stage. */
  visitedFilesInStage: Set<string>
  /** Monotonic counter bumped when something explicitly asks the explorer to
   *  reveal the active file's folder chain (e.g. a cover-list click). The
   *  auto-reveal effect on activeFile change handles the "new file becomes
   *  active" case, but a click whose target is already activeFile leaves
   *  activeFile unchanged and the effect doesn't re-fire — this token is the
   *  separate signal that always fires regardless of activeFile equality. */
  explorerRevealToken: number
}

/** Pure helper for visited-set transitions. `reset` clears the set first
 *  (used on cross-stage entry); `addFile` adds a path if non-null and not
 *  already present. Returns the input reference unchanged when nothing
 *  needs to change so Zustand can skip subscriber notifications. */
function updateVisitedSet(
  current: Set<string>,
  options: { reset?: boolean; addFile?: string | null },
): Set<string> {
  const base = options.reset ? new Set<string>() : current
  const file = options.addFile ?? null
  if (!file) return base
  if (base === current && current.has(file)) return current
  if (base !== current && base.has(file)) return base
  const next = new Set(base)
  next.add(file)
  return next
}

/** Visited-set transition for screen changes. Layered on top of
 *  `updateVisitedSet` to also handle the "cover changed within a stage" case:
 *  when the new screen's cover reference differs from the previous (i.e. the
 *  step authored its own cover or reset to a different stage default), any
 *  files that appear in the new cover get cleared from visited so the
 *  presenter is prompted to re-visit them under the new step's framing.
 *  Files visited that aren't in the new cover stay ticked — they're not the
 *  step's todo, so we don't dirty them. Cross-stage entry skips this and
 *  goes straight to a full reset. */
function updateVisitedForScreenChange(
  current: Set<string>,
  options: {
    crossingStage: boolean
    coverChanged: boolean
    nextCover: CoverItem[] | undefined
    addFile: string | null
  },
): Set<string> {
  if (options.crossingStage) {
    return options.addFile ? new Set([options.addFile]) : new Set()
  }
  let visited = current
  if (options.coverChanged && options.nextCover) {
    const newCoverFiles = new Set(options.nextCover.map((c) => c.file))
    const filtered = new Set<string>()
    for (const f of current) if (!newCoverFiles.has(f)) filtered.add(f)
    if (filtered.size !== current.size) visited = filtered
  }
  return updateVisitedSet(visited, { addFile: options.addFile })
}

type AppActions = {
  setProject: (
    project: PrezlProject,
    rawFiles: Map<string, string>,
    binaryFiles: Set<string>,
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
  closeOtherTabs: (path: string) => void
  closeAllTabs: () => void
  setActiveFile: (path: string | null) => void
  setStatusMessage: (msg: string) => void
  setPreferences: (patch: Partial<Preferences>) => void
  setLoading: (loading: boolean) => void
  setLoadError: (err: LoadError | null) => void
  /** With no argument: inspects the current screen's resolved preview list.
   *  Empty/undefined → status toast and bail. Exactly one entry → launch it
   *  directly. More than one → set previewState to `picker` so the modal
   *  opens. With an explicit preview argument (e.g. a picker selection)
   *  launches that one directly. */
  runPreview: (preview?: Preview) => Promise<void>
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
  /** Bump explorerRevealToken so the explorer expands the active file's
   *  folder chain, even when activeFile didn't change in this update. */
  requestExplorerReveal: () => void
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
      binaryFiles: state.binaryFiles,
      currentScreenId: target.id,
      screenIndex,
    })
    let openTabs: string[]
    let activeFile: string | null
    if (target.open === null) {
      // Author declared "no file" on this screen; honor it on back-nav too.
      openTabs = []
      activeFile = null
    } else {
      const visible = new Set(visibleFiles)
      openTabs = state.openTabs.filter((p) => visible.has(p))
      activeFile = loc.file && visible.has(loc.file) ? loc.file : null
      if (activeFile && !openTabs.includes(activeFile)) {
        openTabs = [...openTabs, activeFile]
      }
      if (!activeFile && openTabs.length > 0) {
        activeFile = openTabs[openTabs.length - 1]!
      }
      // No visibleFiles[0] fallback — if the recorded location had no file,
      // back-nav restores the empty pane the presenter actually saw.
    }

    set({
      currentScreenId: target.id,
      openTabs,
      activeFile,
      pendingScrollTop: getScrollPosition(target.id, activeFile),
      visitedFilesInStage: updateVisitedForScreenChange(
        state.visitedFilesInStage,
        {
          crossingStage,
          coverChanged: !crossingStage && previous?.cover !== target.cover,
          nextCover: target.cover,
          addFile: activeFile,
        },
      ),
    })

    if (crossingStage) {
      setTimeout(() => {
        if (get().currentScreenId === target.id) {
          set({ statusMessage: 'Ready' })
        }
      }, 400)
    }
  }

  return {
  project: null,
  rawFiles: new Map(),
  binaryFiles: new Set(),
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
  explorerResetToken: 0,
  visitedFilesInStage: new Set(),
  explorerRevealToken: 0,

  setProject: (project, rawFiles, binaryFiles, initialStageAlias) => {
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
          binaryFiles,
          currentScreenId: initialScreen.id,
          screenIndex,
        })
      : []
    // Initial active file is the resolved authoring intent only — no
    // visibleFiles[0] fallback. With nothing declared the project starts
    // with a clean file tree; the presenter clicks (or `open:` on a later
    // stage) to bring something up.
    const intended = initialScreen?.open?.file
    const firstFile =
      intended && visibleFiles.includes(intended) ? intended : null
    // Always reset previewState on project load so a stale modal from a
    // previous project never bleeds through. If the initial screen carries
    // an autoLaunch video, open it directly here — switchScreen isn't
    // called for the initial screen, so its autolaunch hook wouldn't fire
    // on cold start.
    let previewState: PreviewState = { kind: 'closed' }
    const initialAutoStart = initialScreen
      ? autoLaunchStartFor(null, initialScreen)
      : null
    if (initialAutoStart) {
      previewState = { kind: 'video', preview: initialAutoStart }
    }
    scrollPositions.clear()
    const initialHistory: HistoryLocation[] = initialScreen
      ? [{ screenId: initialScreen.id, file: firstFile }]
      : []
    set({
      project,
      rawFiles,
      binaryFiles,
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
      visitedFilesInStage: updateVisitedSet(new Set(), {
        reset: true,
        addFile: firstFile,
      }),
    })
  },

  clearProject: () => {
    scrollPositions.clear()
    set({
      project: null,
      rawFiles: new Map(),
      binaryFiles: new Set(),
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
      visitedFilesInStage: new Set(),
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
    const targetStage = crossingStage
      ? project.stages.find((s) => s.alias === target.stageAlias)
      : undefined

    if (crossingStage) {
      const label =
        targetStage?.branch ?? targetStage?.title ?? target.stageAlias
      set({ statusMessage: `Switching to ${label}...` })
    }

    const visibleFiles = computeVisibleFiles({
      files: project.files,
      rawFiles: state.rawFiles,
      binaryFiles: state.binaryFiles,
      currentScreenId: target.id,
      screenIndex,
    })
    let next = reconcileScreenSwitch({
      screen: target,
      visibleFiles,
      openTabs: state.openTabs,
      activeFile: state.activeFile,
    })
    // Stage-level reset: cross-stage entry into an opted-in stage clears
    // every other tab and signals the explorer to collapse folders outside
    // the active file's chain. Step transitions inside the stage and
    // back-nav (which goes through applyHistoryLocation, not this path)
    // never trigger reset — re-grounding only fires on a true stage entry.
    const resetting = crossingStage && targetStage?.reset === true
    if (resetting) next = applyStageEntryReset(next)
    set({
      currentScreenId: target.id,
      openTabs: next.openTabs,
      activeFile: next.activeFile,
      visitedFilesInStage: updateVisitedForScreenChange(
        state.visitedFilesInStage,
        {
          crossingStage,
          coverChanged: !crossingStage && previous?.cover !== target.cover,
          nextCover: target.cover,
          addFile: next.activeFile,
        },
      ),
      ...(resetting
        ? { explorerResetToken: state.explorerResetToken + 1 }
        : {}),
    })
    // Don't stomp on an already-open preview (rare — modal absorbs Space —
    // but defensive against stage-dropdown jumps mid-modal).
    if (get().previewState.kind === 'closed') {
      const autoStart = autoLaunchStartFor(previous, target)
      if (autoStart) {
        set({ previewState: { kind: 'video', preview: autoStart } })
      }
    }
    if (crossingStage) {
      setTimeout(() => {
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
    // Trail-with-video: forward-leaving a screen whose preview list contains
    // an `autoLaunch: 'end'` video opens it instead of advancing. Fires only
    // when the next screen's autoEnd entry differs by reference (or absent)
    // — when a step inherits the stage's preview list both screens share
    // the same entry, so the trailing video doesn't re-fire on every step.
    // lastEndAutoLaunchedScreenId then suppresses the re-fire on the
    // immediate "advance after watching" press. Stays inert when a modal is
    // already up — defensive against rapid input.
    if (delta === 1 && state.previewState.kind === 'closed') {
      const current = ordered[idx]
      const next = ordered[idx + 1] ?? null
      const autoEnd = findAutoLaunchVideo(current, 'end')
      const nextAutoEnd = findAutoLaunchVideo(next, 'end')
      const leavingScope = autoEnd !== nextAutoEnd
      if (
        autoEnd &&
        leavingScope &&
        state.lastEndAutoLaunchedScreenId !== current.id
      ) {
        set({
          previewState: { kind: 'video', preview: autoEnd, trailing: true },
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
      visitedFilesInStage: updateVisitedSet(s.visitedFilesInStage, {
        addFile: path,
      }),
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

  closeOtherTabs: (path) =>
    set((s) => {
      if (!s.openTabs.includes(path)) return {}
      return { openTabs: [path], activeFile: path }
    }),

  closeAllTabs: () => set({ openTabs: [], activeFile: null }),

  setActiveFile: (path) => {
    set((s) => ({
      activeFile: path,
      visitedFilesInStage: updateVisitedSet(s.visitedFilesInStage, {
        addFile: path,
      }),
    }))
    recordCurrent()
  },

  setStatusMessage: (msg) => set({ statusMessage: msg }),

  setPreferences: (patch) =>
    set((s) => ({ preferences: { ...s.preferences, ...patch } })),

  setLoading: (loading) => set({ loading }),
  setLoadError: (loadError) => set({ loadError }),

  runPreview: async (chosen?: Preview) => {
    const state = get()
    if (state.previewState.kind !== 'closed' && !chosen) {
      // Don't restart a modal that's already up unless the picker is
      // explicitly resolving a selection.
      return
    }
    let preview: Preview
    if (chosen) {
      preview = chosen
    } else {
      const screen =
        state.screenIndex && state.currentScreenId
          ? (state.screenIndex.byId[state.currentScreenId] ?? null)
          : null
      const list = screen?.previews ?? []
      if (list.length === 0) {
        set({ statusMessage: 'No preview configured' })
        window.setTimeout(() => {
          if (get().statusMessage === 'No preview configured') {
            set({ statusMessage: 'Ready' })
          }
        }, 1500)
        return
      }
      if (list.length > 1) {
        set({ previewState: { kind: 'picker', previews: list } })
        return
      }
      preview = list[0]
    }

    set({
      previewState: { kind: 'launching', preview },
      statusMessage: 'Preparing...',
    })
    await sleep(BUILD_DELAY_MS)
    if (get().previewState.kind !== 'launching') return
    set({ statusMessage: 'Ready' })
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
      visitedFilesInStage: updateVisitedSet(s.visitedFilesInStage, {
        addFile: file,
      }),
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

  requestExplorerReveal: () =>
    set((s) => ({ explorerRevealToken: s.explorerRevealToken + 1 })),
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
