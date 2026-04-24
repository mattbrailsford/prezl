import { loader } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { shikiToMonaco } from '@shikijs/monaco'
import { bundledThemes, createHighlighter } from 'shiki'

export type PrezlMonaco = typeof Monaco & {
  __prezlRegisterFolding?: typeof Monaco.languages.registerFoldingRangeProvider
}

/** Custom theme name — github-dark tokens, overridden editor chrome to
 *  match Prezl's app surface color so the editor blends with the shell. */
export const PREZL_THEME = 'prezl-dark'
/** Shiki theme to base our custom theme on. */
const BASE_THEME: keyof typeof bundledThemes = 'dark-plus'
/** Keep in sync with --color-app-surface in globals.css (rgb 30 30 34). */
const EDITOR_BG = '#1e1e22'

/** Languages we bundle up-front. Matches `inferLanguage` in CodeEditor plus
 *  the common config / markup formats a Prezl project might show. */
const SHIKI_LANGS = [
  'typescript',
  'javascript',
  'jsx',
  'tsx',
  'csharp',
  'razor',
  'rust',
  'go',
  'python',
  'java',
  'kotlin',
  'swift',
  'ruby',
  'php',
  'c',
  'cpp',
  'shellscript',
  'sql',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'toml',
  'markdown',
  'vue',
  'svelte',
  'xml',
] as const

let ready: Promise<PrezlMonaco> | null = null

/**
 * Initialise Monaco, integrate Shiki for VS Code-quality syntax highlighting,
 * and lock out non-Prezl FoldingRangeProviders — all before any model is
 * created. The bundled TypeScript language service registers its own
 * (bracket-aware) folding provider when its worker boots; if we don't patch
 * first, Monaco merges its ranges with ours and we end up with duplicate fold
 * toggles in the gutter.
 *
 * Shiki gives us real TextMate-grammar tokens for ~200 languages using VS
 * Code's own themes. Costs ~200-400KB and ~100ms warm-up; worth it for
 * presentation-grade code rendering.
 */
export function initMonaco(): Promise<PrezlMonaco> {
  if (ready) return ready
  ready = loader.init().then(async (monaco) => {
    const mon = monaco as PrezlMonaco

    // Patch folding-provider registration *before* registering languages.
    const original = mon.languages.registerFoldingRangeProvider.bind(
      mon.languages,
    )
    mon.__prezlRegisterFolding = original
    ;(mon.languages as unknown as {
      registerFoldingRangeProvider: (
        ...args: unknown[]
      ) => { dispose: () => void }
    }).registerFoldingRangeProvider = () => ({ dispose: () => {} })

    // Register every language we'll highlight with Monaco first. Shiki's
    // adapter attaches tokenizers to existing registered languages.
    for (const lang of SHIKI_LANGS) {
      if (!mon.languages.getLanguages().some((l) => l.id === lang)) {
        mon.languages.register({ id: lang })
      }
    }

    try {
      // Load the base theme from Shiki's bundle, then override its editor
      // background/gutter colors so the editor surface matches the rest of
      // the Prezl chrome instead of popping against it.
      const baseLoader = bundledThemes[BASE_THEME]
      const baseModule = await baseLoader()
      const base = (baseModule as { default?: unknown }).default ?? baseModule
      // Shiki's ThemeRegistration shape is loosely typed; narrow enough to
      // spread / patch without a full import dance.
      const baseTheme = base as {
        name?: string
        colors?: Record<string, string>
        [k: string]: unknown
      }
      const prezlTheme = {
        ...baseTheme,
        name: PREZL_THEME,
        colors: {
          ...(baseTheme.colors ?? {}),
          'editor.background': EDITOR_BG,
          'editor.lineHighlightBackground': '#26262a',
          'editorGutter.background': EDITOR_BG,
          'editorLineNumber.foreground': '#5a5a66',
          'editorLineNumber.activeForeground': '#b8b8c4',
        },
      }

      const highlighter = await createHighlighter({
        themes: [prezlTheme],
        langs: SHIKI_LANGS as unknown as string[],
      })
      shikiToMonaco(highlighter, mon)
    } catch (e) {
      // Non-fatal: fall back to Monaco's built-in tokenizers.
      // eslint-disable-next-line no-console
      console.warn('[prezl] Shiki init failed, using Monaco defaults:', e)
    }

    return mon
  })
  return ready
}

export function prezlRegisterFolding(
  monaco: PrezlMonaco,
): typeof Monaco.languages.registerFoldingRangeProvider {
  // Fallback to the current (patched) function if the kick-off init hasn't
  // landed yet — safer than throwing during tests / SSR.
  return (
    monaco.__prezlRegisterFolding ??
    monaco.languages.registerFoldingRangeProvider.bind(monaco.languages)
  )
}
