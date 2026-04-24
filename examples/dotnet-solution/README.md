# dotnet-solution demo

A two-project Prezl demo to exercise the multi-project explorer:

- `Backend` — a tiny ASP.NET Core Web API (Program.cs + WeatherController +
  WeatherService).
- `Frontend` — a React+TypeScript client that fetches the forecast.

Both projects live under `files/src/…` and are declared as separate
`projects:` entries in `prezl.yaml`, which tells the explorer to render
them as distinct top-level nodes with their own icons.

Stages:

1. **Starting point** — `Program.cs` only (no backend or UI wiring yet).
2. **Add Weather API** — backend controllers/services appear, Program.cs
   picks up the registrations.
3. **Wire the UI** — frontend files appear; the `fetchForecast` ↔
   `getForecast` symbol jump exercises cross-project symbol navigation.
