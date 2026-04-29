import { useCurrentScreen, useScreenIndex } from '@/hooks/useRenderedFile'

/** Shows "n / N" plus an optional step name for the current step within
 *  its stage. Hidden when the active stage has only one screen — keeping
 *  the bar uncluttered for decks that don't use sub-steps.
 *
 *  Layout: numbers left, name right. Numbers sit in their own fixed-ish
 *  cell so the name growing/shrinking doesn't make the count jitter as
 *  the presenter walks through steps. */
export function StepIndicator() {
  const screen = useCurrentScreen()
  const screenIndex = useScreenIndex()
  if (!screen) return null
  const stageScreens = screenIndex.byStage[screen.stageId]?.screens ?? []
  if (stageScreens.length < 2) return null
  const idx = stageScreens.findIndex((s) => s.id === screen.id)
  if (idx < 0) return null
  const label = screen.title ?? screen.stepId ?? ''
  return (
    <span
      className="flex items-center gap-2 rounded bg-app-panel px-2 py-0.5 text-sm text-app-muted"
      title={`Step ${idx + 1} of ${stageScreens.length}${label ? `: ${label}` : ''}`}
    >
      <span className="tabular-nums">
        {idx + 1} / {stageScreens.length}
      </span>
      {label && (
        <>
          <span aria-hidden className="text-app-muted/60">•</span>
          <span className="max-w-[24ch] truncate text-app-fg/80">{label}</span>
        </>
      )}
    </span>
  )
}
