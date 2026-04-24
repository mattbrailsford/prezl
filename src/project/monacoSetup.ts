import { loader } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'

export type PrezlMonaco = typeof Monaco & {
  __prezlRegisterFolding?: typeof Monaco.languages.registerFoldingRangeProvider
}

let ready: Promise<PrezlMonaco> | null = null

/**
 * Initialise Monaco and lock out non-Prezl FoldingRangeProviders *before* any
 * model is created. The bundled TypeScript language service registers its own
 * (bracket-aware) folding provider when its worker boots — if we don't patch
 * first, Monaco merges its ranges with ours and we end up with duplicate fold
 * toggles in the gutter.
 */
export function initMonaco(): Promise<PrezlMonaco> {
  if (ready) return ready
  ready = loader.init().then((monaco) => {
    const mon = monaco as PrezlMonaco
    const original = mon.languages.registerFoldingRangeProvider.bind(
      mon.languages,
    )
    mon.__prezlRegisterFolding = original
    ;(mon.languages as unknown as {
      registerFoldingRangeProvider: (
        ...args: unknown[]
      ) => { dispose: () => void }
    }).registerFoldingRangeProvider = () => ({ dispose: () => {} })
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
