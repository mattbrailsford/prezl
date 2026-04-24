// @prezl file=[api...]

using Microsoft.AspNetCore.Mvc;

namespace Contoso.Weather.Backend.Api;

// @prezl id=weatherController focus=[api]
[ApiController]
[Route("api/[controller]")]
public class WeatherController : ControllerBase
{
    private readonly IWeatherService _service;

    public WeatherController(IWeatherService service)
    {
        _service = service;
    }

    // @prezl id=getForecast focus=[ui]
    [HttpGet("forecast")]
    public async Task<ActionResult<WeatherForecast[]>> GetForecast(int days = 5)
    {
        var forecast = await _service.GetForecastAsync(days);
        return Ok(forecast);
    }
}

// @prezl collapse label="Shared DTOs"
public record WeatherForecast(DateOnly Date, int TemperatureC, string Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
// @prezl end
