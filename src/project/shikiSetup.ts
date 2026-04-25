import {
  bundledThemes,
  createHighlighter,
  type HighlighterCore,
  type ThemedToken,
} from 'shiki'

export const PREZL_THEME = 'prezl-dark'
const BASE_THEME: keyof typeof bundledThemes = 'dark-plus'

/** Languages we bundle up-front. Anything not listed falls back to plaintext
 *  rendering — still readable, just no syntax colours. */
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

export type ShikiToken = ThemedToken

let highlighterPromise: Promise<HighlighterCore> | null = null

/** Singleton — first call kicks off the load (~150–250 KB), subsequent calls
 *  share the resolved highlighter. The renderer awaits this and tokenizes
 *  synchronously once it's ready. */
export function getHighlighter(): Promise<HighlighterCore> {
  if (highlighterPromise) return highlighterPromise
  highlighterPromise = (async () => {
    const themeLoader = bundledThemes[BASE_THEME]
    const themeModule = await themeLoader()
    const themeData = (themeModule as { default?: unknown }).default ?? themeModule
    const themed = themeData as { name?: string; [k: string]: unknown }
    const prezlTheme = { ...themed, name: PREZL_THEME }
    return createHighlighter({
      themes: [prezlTheme],
      langs: SHIKI_LANGS as unknown as string[],
    })
  })()
  return highlighterPromise
}

export function inferLanguage(path: string | null): string {
  if (!path) return 'plaintext'
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'cs':
      return 'csharp'
    case 'json':
      return 'json'
    case 'md':
      return 'markdown'
    case 'rs':
      return 'rust'
    case 'py':
      return 'python'
    case 'razor':
    case 'cshtml':
      return 'razor'
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'scss':
      return 'scss'
    case 'yml':
    case 'yaml':
      return 'yaml'
    case 'toml':
      return 'toml'
    case 'java':
      return 'java'
    case 'kt':
      return 'kotlin'
    case 'swift':
      return 'swift'
    case 'rb':
      return 'ruby'
    case 'php':
      return 'php'
    case 'go':
      return 'go'
    case 'c':
    case 'h':
      return 'c'
    case 'cpp':
    case 'hpp':
      return 'cpp'
    case 'sh':
    case 'bash':
      return 'shellscript'
    case 'sql':
      return 'sql'
    case 'xml':
      return 'xml'
    case 'vue':
      return 'vue'
    case 'svelte':
      return 'svelte'
    default:
      return 'plaintext'
  }
}
