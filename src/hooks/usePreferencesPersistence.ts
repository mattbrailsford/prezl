import { useEffect, useRef } from 'react'
import { useAppStore } from '@/state/store'
import {
  loadPersistedPreferences,
  persistPreferences,
} from './useUiScale'
import { DEFAULT_PREFERENCES, type Preferences } from '@/types'

/**
 * Hydrates preferences from localStorage on mount and writes back on change.
 * M1 uses localStorage; M2 migrates to appConfigDir/preferences.json once
 * the Tauri fs plugin is wired in.
 */
export function usePreferencesPersistence() {
  const preferences = useAppStore((s) => s.preferences)
  const setPreferences = useAppStore((s) => s.setPreferences)
  const hydrated = useRef(false)

  useEffect(() => {
    const persisted = loadPersistedPreferences() as Partial<Preferences> | null
    if (persisted) {
      setPreferences({ ...DEFAULT_PREFERENCES, ...persisted })
    }
    hydrated.current = true
  }, [setPreferences])

  useEffect(() => {
    if (!hydrated.current) return
    persistPreferences(preferences)
  }, [preferences])
}
