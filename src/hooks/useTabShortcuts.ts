import { useEffect } from 'react'
import { useAppStore } from '@/state/store'
import { useCurrentScreen, useSymbolTable } from './useRenderedFile'

/**
 * Tab + anchor keyboard shortcuts.
 *
 *   Ctrl+W           -> close the active tab
 *   Ctrl+Home        -> re-apply the current screen's `open:` intent (the
 *                       authored anchor). Useful when the presenter closed
 *                       the README / opened tab and wants to land back on
 *                       what the screen was supposed to show without
 *                       rewinding the deck.
 *
 * Capture phase so a focused element doesn't claim the keys first.
 * Suppressed when:
 *   - any modal-like demo state is up (video, picker, launching, url)
 *   - the symbol finder is open (it has its own keyboard contract)
 *   - focus is on a real text-typing surface (input, textarea,
 *     contentEditable) — Ctrl+W in those should still mean what the user
 *     expects from a text control. Buttons/selects fall through.
 */
export function useTabShortcuts() {
  const closeTab = useAppStore((s) => s.closeTab)
  const openFile = useAppStore((s) => s.openFile)
  const navigateToFileLine = useAppStore((s) => s.navigateToFileLine)
  const setStatusMessage = useAppStore((s) => s.setStatusMessage)
  const screen = useCurrentScreen()
  const symbolTable = useSymbolTable()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return

      const state = useAppStore.getState()
      const demoKind = state.demoState.kind
      if (
        demoKind === 'video' ||
        demoKind === 'picker' ||
        demoKind === 'launching' ||
        demoKind === 'url'
      ) {
        return
      }
      if (state.symbolFinderOpen) return
      if (isTypingTarget(e.target)) return

      // Ctrl+W — close the active tab. No-op when nothing is open.
      if (e.key === 'w' || e.key === 'W') {
        const active = state.activeFile
        if (!active) return
        e.preventDefault()
        e.stopPropagation()
        closeTab(active)
        return
      }

      // Ctrl+Home — re-apply screen.open. Resolution mirrors what CodeView's
      // scroll effect does on screen change, but driven on demand: bare line
      // → navigateToFileLine, id → look up in the symbol table and navigate
      // (works even when the file is already active — pendingNavigation
      // bumps regardless), else just openFile.
      //
      // Ctrl+H is an alias for laptops that don't expose a Home key. Browsers
      // bind Ctrl+H to history, but capture-phase preventDefault stops that
      // before the WebView sees it.
      if (e.key === 'Home' || e.key === 'h' || e.key === 'H') {
        const target = screen?.open
        if (!target || !target.file) {
          flashStatus(setStatusMessage, 'No anchor on this screen')
          e.preventDefault()
          e.stopPropagation()
          return
        }
        let line: number | null = null
        if (target.line) {
          line = target.line
        } else if (target.id) {
          const sym = symbolTable.get(target.id)
          if (sym && sym.file === target.file) line = sym.line
        }
        e.preventDefault()
        e.stopPropagation()
        if (line) {
          navigateToFileLine(target.file, line)
        } else {
          openFile(target.file)
        }
        return
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKey, {
        capture: true,
      } as EventListenerOptions)
  }, [
    closeTab,
    openFile,
    navigateToFileLine,
    setStatusMessage,
    screen,
    symbolTable,
  ])
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}

function flashStatus(setStatusMessage: (m: string) => void, msg: string) {
  setStatusMessage(msg)
  window.setTimeout(() => {
    if (useAppStore.getState().statusMessage === msg) {
      setStatusMessage('Ready')
    }
  }, 1500)
}
