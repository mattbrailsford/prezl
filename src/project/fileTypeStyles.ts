/**
 * Per-extension visual metadata used by both the explorer (file icon
 * colour) and the editor tabs (file-type accent on the active tab's top
 * border). Tailwind class strings are kept as literals so the JIT scanner
 * picks them up — never construct them dynamically.
 *
 * `topBorderColor` is intentionally directional (`border-t-*`) rather than
 * the all-sides `border-*` shorthand, so a consumer combining it with
 * `border-r border-app-border` doesn't have the accent bleed onto the
 * right edge.
 */
export type FileTypeStyle = {
  /** Use the FileCode glyph (vs. plain File) for this extension. */
  code: boolean
  /** Tailwind text-* class for icon / type-coloured text. */
  textColor: string
  /** Tailwind border-t-* class — colours only the top border. */
  topBorderColor: string
}

export const FILE_TYPE_STYLES: Record<string, FileTypeStyle> = {
  // JS/TS
  ts: { code: true, textColor: 'text-sky-400', topBorderColor: 'border-t-sky-400' },
  tsx: { code: true, textColor: 'text-sky-400', topBorderColor: 'border-t-sky-400' },
  js: { code: true, textColor: 'text-yellow-300', topBorderColor: 'border-t-yellow-300' },
  jsx: { code: true, textColor: 'text-yellow-300', topBorderColor: 'border-t-yellow-300' },
  mjs: { code: true, textColor: 'text-yellow-300', topBorderColor: 'border-t-yellow-300' },
  cjs: { code: true, textColor: 'text-yellow-300', topBorderColor: 'border-t-yellow-300' },
  // .NET
  cs: { code: true, textColor: 'text-violet-400', topBorderColor: 'border-t-violet-400' },
  razor: { code: true, textColor: 'text-violet-300', topBorderColor: 'border-t-violet-300' },
  cshtml: { code: true, textColor: 'text-violet-300', topBorderColor: 'border-t-violet-300' },
  csproj: { code: false, textColor: 'text-violet-400', topBorderColor: 'border-t-violet-400' },
  vbproj: { code: false, textColor: 'text-violet-400', topBorderColor: 'border-t-violet-400' },
  fsproj: { code: false, textColor: 'text-violet-400', topBorderColor: 'border-t-violet-400' },
  props: { code: false, textColor: 'text-violet-300', topBorderColor: 'border-t-violet-300' },
  targets: { code: false, textColor: 'text-violet-300', topBorderColor: 'border-t-violet-300' },
  xaml: { code: false, textColor: 'text-violet-300', topBorderColor: 'border-t-violet-300' },
  resx: { code: false, textColor: 'text-violet-300', topBorderColor: 'border-t-violet-300' },
  // Rust / Go / systems
  rs: { code: true, textColor: 'text-orange-400', topBorderColor: 'border-t-orange-400' },
  go: { code: true, textColor: 'text-cyan-400', topBorderColor: 'border-t-cyan-400' },
  c: { code: true, textColor: 'text-blue-500', topBorderColor: 'border-t-blue-500' },
  h: { code: true, textColor: 'text-blue-500', topBorderColor: 'border-t-blue-500' },
  cpp: { code: true, textColor: 'text-blue-500', topBorderColor: 'border-t-blue-500' },
  hpp: { code: true, textColor: 'text-blue-500', topBorderColor: 'border-t-blue-500' },
  // JVM / friends
  java: { code: true, textColor: 'text-red-400', topBorderColor: 'border-t-red-400' },
  kt: { code: true, textColor: 'text-orange-400', topBorderColor: 'border-t-orange-400' },
  swift: { code: true, textColor: 'text-orange-500', topBorderColor: 'border-t-orange-500' },
  // Script
  py: { code: true, textColor: 'text-emerald-400', topBorderColor: 'border-t-emerald-400' },
  rb: { code: true, textColor: 'text-red-500', topBorderColor: 'border-t-red-500' },
  php: { code: true, textColor: 'text-indigo-400', topBorderColor: 'border-t-indigo-400' },
  sh: { code: true, textColor: 'text-green-300', topBorderColor: 'border-t-green-300' },
  bash: { code: true, textColor: 'text-green-300', topBorderColor: 'border-t-green-300' },
  // Frameworks / UI
  vue: { code: true, textColor: 'text-emerald-400', topBorderColor: 'border-t-emerald-400' },
  svelte: { code: true, textColor: 'text-orange-500', topBorderColor: 'border-t-orange-500' },
  // Styling
  css: { code: false, textColor: 'text-pink-400', topBorderColor: 'border-t-pink-400' },
  scss: { code: false, textColor: 'text-pink-500', topBorderColor: 'border-t-pink-500' },
  sass: { code: false, textColor: 'text-pink-500', topBorderColor: 'border-t-pink-500' },
  less: { code: false, textColor: 'text-pink-400', topBorderColor: 'border-t-pink-400' },
  // Markup / config
  html: { code: false, textColor: 'text-orange-400', topBorderColor: 'border-t-orange-400' },
  xml: { code: false, textColor: 'text-orange-300', topBorderColor: 'border-t-orange-300' },
  xsd: { code: false, textColor: 'text-orange-300', topBorderColor: 'border-t-orange-300' },
  xslt: { code: false, textColor: 'text-orange-300', topBorderColor: 'border-t-orange-300' },
  svg: { code: false, textColor: 'text-orange-300', topBorderColor: 'border-t-orange-300' },
  config: { code: false, textColor: 'text-orange-300', topBorderColor: 'border-t-orange-300' },
  json: { code: false, textColor: 'text-yellow-400', topBorderColor: 'border-t-yellow-400' },
  yaml: { code: false, textColor: 'text-red-400', topBorderColor: 'border-t-red-400' },
  yml: { code: false, textColor: 'text-red-400', topBorderColor: 'border-t-red-400' },
  toml: { code: false, textColor: 'text-amber-400', topBorderColor: 'border-t-amber-400' },
  md: { code: false, textColor: 'text-sky-300', topBorderColor: 'border-t-sky-300' },
  mdx: { code: false, textColor: 'text-sky-300', topBorderColor: 'border-t-sky-300' },
  sql: { code: false, textColor: 'text-orange-300', topBorderColor: 'border-t-orange-300' },
}

export function fileTypeStyle(name: string): FileTypeStyle | undefined {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return FILE_TYPE_STYLES[ext]
}
