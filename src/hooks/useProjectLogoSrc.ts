import { useMemo } from 'react'
import { useAppStore } from '@/state/store'
import { convertProjectFileSrc } from '@/project/assetSrc'

/** Resolve the project's `logo:` (if any) to a webview-loadable URL.
 *  Returns null when the project sets no logo or no project is open —
 *  callers fall back to the Prezl pretzel mark in that case. */
export function useProjectLogoSrc(): string | null {
  const logo = useAppStore((s) => s.project?.logo)
  const rootPath = useAppStore((s) => s.project?.rootPath ?? null)

  return useMemo(() => {
    if (!logo || !rootPath) return null
    if (/^https?:\/\//i.test(logo)) return logo
    const cleaned = logo.replace(/^\.\//, '')
    const absolute =
      cleaned.startsWith('/') || /^[A-Za-z]:[\\/]/.test(cleaned)
        ? cleaned
        : `${rootPath}/${cleaned}`
    return convertProjectFileSrc(absolute)
  }, [logo, rootPath])
}
