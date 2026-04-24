import { create } from 'zustand'
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type PrezlProject,
  type PreviewState,
} from '@/types'

type AppState = {
  project: PrezlProject | null
  currentBranchName: string | null
  openTabs: string[]
  activeFile: string | null
  statusMessage: string
  previewState: PreviewState
  preferences: Preferences
}

type AppActions = {
  setProject: (project: PrezlProject, initialBranchName?: string) => void
  switchBranch: (name: string) => void
  openFile: (path: string) => void
  closeTab: (path: string) => void
  setActiveFile: (path: string | null) => void
  setStatusMessage: (msg: string) => void
  setPreferences: (patch: Partial<Preferences>) => void
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  project: null,
  currentBranchName: null,
  openTabs: [],
  activeFile: null,
  statusMessage: 'Ready',
  previewState: { kind: 'closed' },
  preferences: DEFAULT_PREFERENCES,

  setProject: (project, initialBranchName) => {
    const branch = project.branches.find((b) => b.name === initialBranchName) ?? project.branches[0]
    const firstFile = branch?.open?.file ?? branch?.files[0]?.path ?? null
    set({
      project,
      currentBranchName: branch?.name ?? null,
      openTabs: firstFile ? [firstFile] : [],
      activeFile: firstFile,
      statusMessage: 'Ready',
    })
  },

  switchBranch: (name) => {
    // Full reducer lands in M2. For now it just swaps the name.
    set({ currentBranchName: name, statusMessage: `Checking out ${name}...` })
    setTimeout(() => set({ statusMessage: 'Ready' }), 350)
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
}))
