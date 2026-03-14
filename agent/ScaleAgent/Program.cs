using ScaleAgent;
using ScaleAgent.Services;

var builder = Host.CreateApplicationBuilder(args);

// Windows Service support (no-op em dev)
builder.Services.AddWindowsService(o => o.ServiceName = "vendApps Scale Agent");

// HTTP client para autenticação na API
builder.Services.AddHttpClient<AgentAuthService>(client =>
{
    var baseUrl = builder.Configuration["ScaleAgent:ApiBaseUrl"]!;
    client.BaseAddress = new Uri(baseUrl);
});

// Serviços de escopo singleton
builder.Services.AddSingleton<FilizolaSerialService>();
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
