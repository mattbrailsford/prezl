import { useCurrentScreen, useScreenIndex } from '@/hooks/useRenderedFile'

/** Shows "n / N" for the current step within its stage. Hidden when the
 *  active stage has only one screen — keeping the bar uncluttered for
 *  decks that don't use sub-steps. */
export function StepIndicator() {
  const screen = useCurrentScreen()
  const screenIndex = useScreenIndex()
  if (!screen) return null
  const stageScreens = screenIndex.byStage[screen.stageAlias]?.screens ?? []
  if (stageScreens.length < 2) return null
  const idx = stageScreens.findIndex((s) => s.id === screen.id)
  if (idx < 0) return null
  return (
    <span
      className="rounded bg-app-panel px-2 py-0.5 text-sm tabular-nums text-app-muted"
      title={`Step ${idx + 1} of ${stageScreens.length}: ${screen.stepAlias ?? ''}`}
    >
      {idx + 1} / {stageScreens.length}
    </span>
  )
}
