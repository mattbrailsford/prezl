import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/state/store'
import { loadProjectFromDisk, pickProjectFolder } from '@/project/loader'
import {
  forgetRecent,
  listRecents,
  rememberRecent,
  type RecentEntry,
} from '@/project/recents'

export function useRecentProjects() {
  const [recents, setRecents] = useState<RecentEntry[]>([])
  const refresh = useCallback(async () => {
    try {
      setRecents(await listRecents())
    } catch {
      setRecents([])
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const forget = useCallback(
    async (path: string) => {
      try {
        setRecents(await forgetRecent(path))
      } catch {
        /* non-fatal */
      }
    },
    [],
  )

  return { recents, refresh, forget }
}

export function useOpenProject() {
  const setProject = useAppStore((s) => s.setProject)
  const setLoading = useAppStore((s) => s.setLoading)
  const setLoadError = useAppStore((s) => s.setLoadError)

  return useCallback(
    async (path: string, opts?: { silentFailure?: boolean }) => {
      setLoading(true)
      setLoadError(null)
      try {
        const result = await loadProjectFromDisk(path)
        if ('error' in result) {
          if (opts?.silentFailure) {
            // Drop the stale recent entry but don't surface an overlay.
            try {
              await forgetRecent(path)
            } catch {
              /* non-fatal */
            }
            return false
          }
          setLoadError(result.error)
          return false
        }
        setProject(result.project, result.rawFiles)
        try {
          await rememberRecent(path, result.project.name)
        } catch {
          /* non-fatal */
        }
        return true
      } finally {
        setLoading(false)
      }
    },
    [setProject, setLoading, setLoadError],
  )
}

export function usePickAndOpenProject() {
  const openProject = useOpenProject()
  return useCallback(async () => {
    const folder = await pickProjectFolder()
    if (!folder) return false
    return openProject(folder)
  }, [openProject])
}
