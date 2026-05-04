// @prezl file=[ui...]

import { useEffect, useState } from 'react'
import { fetchForecast, type Forecast } from '../api/weather'

// @prezl id=weatherComponent focus=[ui]
export function Weather() {
  const [rows, setRows] = useState<Forecast[]>([])

  useEffect(() => {
    fetchForecast().then(setRows)
  }, [])

  return (
    <section className="weather">
      <h2>5-day forecast</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.date}>
            {row.date}: {row.summary} ({row.temperatureC}°C)
          </li>
        ))}
      </ul>
    </section>
  )
}
