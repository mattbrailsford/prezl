using Contoso.Weather.Backend.Api;

var builder = WebApplication.CreateBuilder(args);

// @prezl show=[api...]
builder.Services.AddSingleton<IWeatherService, WeatherService>();
builder.Services.AddControllers();
// @prezl end

var app = builder.Build();

// @prezl show=[api...]
app.MapControllers();
// @prezl end

app.Run();
