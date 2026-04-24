import type { App } from './framework'
import { fetchDashboardData } from './api'

type DashboardConfig = {
  title: string
  refreshInterval: number
}

export function registerDashboard(app: App): void {
  const config: DashboardConfig = {
    title: 'Content insights',
    refreshInterval: 30_000,
  }

  app.dashboards.add({
    id: 'content-insights',
    title: config.title,
    async render(container) {
      container.innerHTML = `<h2>${config.title}</h2>`
      const data = await fetchDashboardData()
      container.appendChild(renderCharts(data))
    },
  })
}

function renderCharts(data: { label: string; value: number }[]): HTMLElement {
  const list = document.createElement('ul')
  for (const row of data) {
    const li = document.createElement('li')
    li.textContent = `${row.label}: ${row.value}`
    list.appendChild(li)
  }
  return list
}
