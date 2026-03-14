using Microsoft.AspNetCore.SignalR.Client;
using ScaleAgent.Models;
using ScaleAgent.Services;

namespace ScaleAgent;

/// <summary>
/// Worker principal: autentica na API, conecta ao hub SignalR e processa
/// comandos de sincronização de produtos para a(s) balança(s).
///
/// Reconecta automaticamente em caso de queda da conexão.
/// </summary>
public class Worker : BackgroundService
{
    private readonly IConfiguration        _config;
    private readonly AgentAuthService      _auth;
    private readonly FilizolaSerialService _scale;
    private readonly ILogger<Worker>       _logger;

    public Worker(
        IConfiguration config,
        AgentAuthService auth,
        FilizolaSerialService scale,
        ILogger<Worker> logger)
    {
        _config = config;
        _auth   = auth;
        _scale  = scale;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("vendApps Scale Agent iniciando...");

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await RunConnectionLoopAsync(ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro na conexão. Reconectando em 15s...");
                await Task.Delay(TimeSpan.FromSeconds(15), ct);
            }
        }

        _logger.LogInformation("Scale Agent encerrado.");
    }

    private async Task RunConnectionLoopAsync(CancellationToken ct)
    {
        // 1. Obtém JWT
        _logger.LogInformation("Autenticando na API...");
        var token = await _auth.GetTokenAsync(ct);
        if (token == null)
        {
            _logger.LogWarning("Autenticação falhou. Aguardando 30s...");
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
            return;
        }

        // 2. Monta URL do hub
        var baseUrl  = _config["ScaleAgent:ApiBaseUrl"]!.TrimEnd('/');
        var hubPath  = _config["ScaleAgent:HubPath"] ?? "/hubs/scale-agent";
        var hubUrl   = baseUrl + hubPath;

        // 3. Cria conexão SignalR
        var hub = new HubConnectionBuilder()
            .WithUrl(hubUrl, options =>
            {
                options.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .WithAutomaticReconnect(new[]
            {
                TimeSpan.FromSeconds(2),
                TimeSpan.FromSeconds(5),
                TimeSpan.FromSeconds(15),
                TimeSpan.FromSeconds(30),
            })
            .Build();

        // 4. Registra handler para sincronização de produtos
        hub.On<string, List<ScaleProductPayload>>("SyncProducts", async (deviceId, products) =>
        {
            _logger.LogInformation(
                "Recebido SyncProducts — deviceId={DeviceId}, {Count} produtos.",
                deviceId, products.Count);

            var portName = _config[$"Devices:{deviceId}:PortName"] ?? "COM1";
            var baudRate = int.TryParse(_config[$"Devices:{deviceId}:BaudRate"], out var b) ? b : 9600;

            var success = await _scale.SyncProductsAsync(portName, baudRate, products, ct);
            var status  = success ? "ok" : "error";

            try
            {
                await hub.InvokeAsync("AckSync", deviceId, status,
                    success ? null : "Falha na comunicação serial.", ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar AckSync.");
            }
        });

        hub.Reconnecting += error =>
        {
            _logger.LogWarning("SignalR reconectando: {Error}", error?.Message);
            return Task.CompletedTask;
        };

        hub.Reconnected += connId =>
        {
            _logger.LogInformation("SignalR reconectado. ConnectionId={ConnId}", connId);
            return Task.CompletedTask;
        };

        hub.Closed += error =>
        {
            _logger.LogWarning("SignalR conexão fechada: {Error}", error?.Message);
            return Task.CompletedTask;
        };

        // 5. Conecta
        _logger.LogInformation("Conectando ao hub: {Url}", hubUrl);
        await hub.StartAsync(ct);
        _logger.LogInformation("Conectado! ConnectionState={State}", hub.State);

        // 6. Mantém vivo até cancelamento ou até hub fechar
        try
        {
            await Task.Delay(Timeout.Infinite, ct);
        }
        catch (OperationCanceledException) { }
        finally
        {
            await hub.DisposeAsync();
        }
    }
}
