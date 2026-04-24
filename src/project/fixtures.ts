import type { PrezlProject } from '@/types'

// M1 hardcoded fixture. Replaced by real disk loading in M2.
export const M1_FIXTURE: PrezlProject = {
  project: {
    name: 'Prezl M1 Shell Demo',
    language: 'typescript',
    theme: 'dark',
  },
  branches: [
    {
      name: 'main',
      alias: 'main',
      title: 'Starting point',
      order: 1,
      files: [{ path: 'src/welcome.ts' }],
      open: { file: 'src/welcome.ts', line: 1 },
    },
  ],
}

export const M1_FILE_CONTENTS: Record<string, string> = {
  'src/welcome.ts': `// Welcome to Prezl
//
// M1: the shell is up. Monaco is rendering this file.
// Try the following:
//   Ctrl+= / Ctrl+-   zoom the UI + editor together
//   Ctrl+0            reset zoom
//   Ctrl+MouseWheel   continuous zoom
//   Ctrl+E            collapse the file explorer
//
// M2 will load a real project from a folder you pick.
// M3 brings @prezl:* comment directives to life.

export function welcome(): string {
  return 'Prezl v0.1 — staged code presentation'
}

export const MILESTONES = [
  'M1 shell',
  'M2 project loading + branches',
  'M3 directive system (show / collapse / focus)',
  'M4 URL preview',
  'M5 video preview + cues',
  'M6 symbol navigation',
  'M7 symbol quick-find (Ctrl+T)',
] as const
`,
}
