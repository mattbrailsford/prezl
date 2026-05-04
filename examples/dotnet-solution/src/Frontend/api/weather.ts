// @prezl file=[ui...]

export type Forecast = {
  date: string
  summary: string
  temperatureC: number
}

// @prezl id=fetchForecast
export async function fetchForecast(days = 5): Promise<Forecast[]> {
  const res = await fetch(`/api/weather/forecast?days=${days}`)
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`)
  return (await res.json()) as Forecast[]
}
