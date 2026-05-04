// @prezl file=[api...]

namespace Contoso.Weather.Backend.Api;

// @prezl id=weatherService
public interface IWeatherService
{
    Task<WeatherForecast[]> GetForecastAsync(int days);
}

// @prezl collapse label="Mock implementation"
public sealed class WeatherService : IWeatherService
{
    private static readonly string[] Summaries = new[]
    {
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot",
    };

    public Task<WeatherForecast[]> GetForecastAsync(int days)
    {
        var forecast = Enumerable.Range(1, days)
            .Select(index => new WeatherForecast(
                DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
                Random.Shared.Next(-20, 55),
                Summaries[Random.Shared.Next(Summaries.Length)]))
            .ToArray();
        return Task.FromResult(forecast);
    }
}
// @prezl end
