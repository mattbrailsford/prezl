import { useEffect, useState } from 'react'
import { useAppStore } from '@/state/store'
import {
  readPreferences,
  writePreferences,
} from '@/project/preferencesIo'
import { DEFAULT_PREFERENCES } from '@/types'

const WRITE_DEBOUNCE_MS = 300

/**
 * Hydrate preferences from `appConfigDir/preferences.json` on mount, then
 * write them back (debounced) whenever they change.
 *
 * Hydration state is a real boolean state, not a ref — that way the write
 * effect only fires AFTER the hydrated values have been committed to React
 * state, which prevents the old bug where the save effect overwrote disk
 * with DEFAULT_PREFERENCES during the brief window between mount and first
 * setState commit.
 */
export function usePreferencesPersistence() {
  const preferences = useAppStore((s) => s.preferences)
  const setPreferences = useAppStore((s) => s.setPreferences)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    readPreferences()
      .then((persisted) => {
        if (cancelled) return
        if (persisted) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...persisted })
        }
        setHydrated(true)
      })
      .catch(() => {
        // Corrupt / unreadable preferences shouldn't block app startup;
        // fall through to defaults and start fresh on next write.
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [setPreferences])

  useEffect(() => {
    if (!hydrated) return
    const id = window.setTimeout(() => {
      writePreferences(preferences).catch(() => {
        /* non-fatal; next change will try again */
      })
    }, WRITE_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [preferences, hydrated])
}
