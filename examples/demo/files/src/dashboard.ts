// @prezl:file [shell...]

import type { App } from './framework'
// @prezl:show [preview...]
import { fetchDashboardData } from './api'
// @prezl:/show

// @prezl:collapse Dashboard config types
type DashboardConfig = {
  title: string
  refreshInterval: number
}
// @prezl:/collapse

// @prezl:mark registerDashboard
// @prezl:focus [shell]
export function registerDashboard(app: App): void {
  const config: DashboardConfig = {
    title: 'Content insights',
    refreshInterval: 30_000,
  }

  app.dashboards.add({
    id: 'content-insights',
    title: config.title,
    // @prezl:show [preview...]
    // @prezl:focus [preview]
    async render(container) {
      container.innerHTML = `<h2>${config.title}</h2>`
      const data = await fetchDashboardData()
      container.appendChild(renderCharts(data))
    },
    // @prezl:/focus
    // @prezl:/show
  })
}
// @prezl:/focus

// @prezl:show [preview...]
// @prezl:collapse Chart rendering helpers
function renderCharts(data: { label: string; value: number }[]): HTMLElement {
  const list = document.createElement('ul')
  for (const row of data) {
    const li = document.createElement('li')
    li.textContent = `${row.label}: ${row.value}`
    list.appendChild(li)
  }
  return list
}
// @prezl:/collapse
// @prezl:/show
