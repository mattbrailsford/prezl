// @prezl file=[shell...] focus=[shell]

import type { App } from './framework'
// @prezl show=[preview...]
import { fetchDashboardData } from './api'
// @prezl end

// @prezl id=DashboardConfig collapse label="Dashboard config types"
type DashboardConfig = {
  title: string
  refreshInterval: number
}
// @prezl end

// @prezl id=registerDashboard focus=[shell]
export function registerDashboard(app: App): void {
  const config: DashboardConfig = {
    title: 'Content insights',
    refreshInterval: 30_000,
  }

  app.dashboards.add({
    id: 'content-insights',
    title: config.title,
    // @prezl show=[preview...] focus=[preview.intro, demo]
    async render(container) {
      container.innerHTML = `<h2>${config.title}</h2>`
      const data = await fetchDashboardData()
      container.appendChild(renderCharts(data))
    },
    // @prezl end
  })
}
// @prezl end

// @prezl show=[preview...] collapse=[preview.intro, preview.fetchImpl, demo] focus=[preview.chartHelpers] label="Chart rendering helpers"
// @prezl id=renderCharts
function renderCharts(data: { label: string; value: number }[]): HTMLElement {
  const list = document.createElement('ul')
  // @prezl show=[preview.chartHelpers]
  // Each row becomes a list item with the label and value rendered inline.
  // @prezl end
  for (const row of data) {
    const li = document.createElement('li')
    li.textContent = `${row.label}: ${row.value}`
    list.appendChild(li)
  }
  return list
}
// @prezl end
