using PrintAgent;
using PrintAgent.Services;

var builder = Host.CreateApplicationBuilder(args);

// Windows Service support (no-op em dev)
builder.Services.AddWindowsService(o => o.ServiceName = "vendApps Print Agent");

// HttpClient para autenticação e chamadas REST à API
builder.Services.AddHttpClient("api", client =>
{
    var baseUrl = builder.Configuration["PrintAgent:ApiBaseUrl"]!;
    client.BaseAddress = new Uri(baseUrl);
});

// HttpClient tipado para o serviço de auth
builder.Services.AddHttpClient<PrintAuthService>(client =>
{
    var baseUrl = builder.Configuration["PrintAgent:ApiBaseUrl"]!;
    client.BaseAddress = new Uri(baseUrl);
});

builder.Services.AddSingleton<SilentPrintService>();
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
