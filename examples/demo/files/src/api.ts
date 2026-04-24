type DashboardRow = {
  label: string
  value: number
}

export async function fetchDashboardData(): Promise<DashboardRow[]> {
  const res = await fetch('/api/dashboard')
  if (!res.ok) {
    throw new Error(`Dashboard fetch failed: ${res.status}`)
  }
  const json = (await res.json()) as { rows: DashboardRow[] }
  return json.rows
}
