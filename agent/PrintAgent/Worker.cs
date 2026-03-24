using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR.Client;
using PrintAgent.Models;
using PrintAgent.Services;

namespace PrintAgent;

/// <summary>
/// Loop principal do agente de impressão:
///   1. Autentica na API e obtém JWT + companyId
///   2. Conecta ao hub SignalR /hubs/print
///   3. Replica jobs pendentes (caso haja fila acumulada)
///   4. Escuta eventos "PrintOrder" e imprime silenciosamente
///   5. Marca cada job como impresso via HTTP
///   6. Reconecta automaticamente em caso de falha
/// </summary>
public class Worker : BackgroundService
{
    private readonly IConfiguration   _config;
    private readonly PrintAuthService _auth;
    private readonly SilentPrintService _printer;
    private readonly HttpClient        _http;
    private readonly ILogger<Worker>   _logger;

    public Worker(
        IConfiguration config,
        PrintAuthService auth,
        SilentPrintService printer,
        IHttpClientFactory httpFactory,
        ILogger<Worker> logger)
    {
        _config  = config;
        _auth    = auth;
        _printer = printer;
        _http    = httpFactory.CreateClient("api");
        _logger  = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("vendApps Print Agent iniciando...");

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await RunLoopAsync(ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro na conexão. Reconectando em 20s...");
                await Task.Delay(TimeSpan.FromSeconds(20), ct);
            }
        }

        _logger.LogInformation("Print Agent encerrado.");
    }

    private async Task RunLoopAsync(CancellationToken ct)
    {
        // 1. Autenticar
        _logger.LogInformation("Autenticando...");
        var login = await _auth.LoginAsync(ct);
        if (login is null)
        {
            _logger.LogWarning("Autenticação falhou. Aguardando 30s...");
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
            return;
        }

        var (token, companyId) = login.Value;

        // Injeta token no HttpClient para chamadas REST (pending + mark-printed)
        _http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // 2. Construir hub SignalR
        var baseUrl = _config["PrintAgent:ApiBaseUrl"]!.TrimEnd('/');
        var hubPath = _config["PrintAgent:HubPath"] ?? "/hubs/print";

        var hub = new HubConnectionBuilder()
            .WithUrl(baseUrl + hubPath, opts =>
            {
                opts.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .WithAutomaticReconnect(new[]
            {
                TimeSpan.FromSeconds(3),
                TimeSpan.FromSeconds(10),
                TimeSpan.FromSeconds(30),
            })
            .Build();

        // 3. Handler para eventos em tempo real
        hub.On<object>("PrintOrder", async (raw) =>
        {
            try
            {
                using var doc = JsonDocument.Parse(raw.ToString()!);
                var root      = doc.RootElement;

                var jobId   = root.GetProperty("jobId").GetGuid();
                var payload = JsonSerializer.Deserialize<PrintOrderPayload>(
                    root.GetProperty("payload").GetRawText(),
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (payload is null) return;

                _logger.LogInformation("Recebido PrintOrder jobId={JobId} pedido={PublicId}",
                    jobId, payload.PublicId);

                _printer.Print(payload);
                await MarkPrintedAsync(jobId, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar PrintOrder.");
            }
        });

        hub.Reconnecting  += e => { _logger.LogWarning("Reconectando: {Err}", e?.Message); return Task.CompletedTask; };
        hub.Reconnected   += _ => { _logger.LogInformation("Reconectado."); return Task.CompletedTask; };
        hub.Closed        += e => { _logger.LogWarning("Hub fechado: {Err}", e?.Message);  return Task.CompletedTask; };

        // 4. Conectar
        _logger.LogInformation("Conectando ao hub {Url}", baseUrl + hubPath);
        await hub.StartAsync(ct);
        await hub.InvokeAsync("JoinCompany", companyId, ct);
        _logger.LogInformation("Conectado ao grupo company-{CompanyId}", companyId);

        // 5. Replay de jobs pendentes (gerados enquanto o agente estava offline)
        await ReplayPendingAsync(ct);

        // 6. Manter conexão viva
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

    private async Task ReplayPendingAsync(CancellationToken ct)
    {
        try
        {
            var pending = await _http.GetFromJsonAsync<List<PendingJobDto>>(
                "/admin/print/pending", ct);

            if (pending is null || pending.Count == 0)
            {
                _logger.LogInformation("Nenhum job pendente na fila.");
                return;
            }

            _logger.LogInformation("Replicando {Count} job(s) pendente(s)...", pending.Count);

            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            foreach (var job in pending)
            {
                try
                {
                    var payload = JsonSerializer.Deserialize<PrintOrderPayload>(
                        job.PrintPayloadJson, opts);

                    if (payload is null) continue;

                    _printer.Print(payload);
                    await MarkPrintedAsync(job.Id, ct);

                    // Pequena pausa entre jobs para não sobrecarregar a fila da impressora
                    await Task.Delay(300, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Falha ao reimprimir job {JobId}", job.Id);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao buscar jobs pendentes (não crítico).");
        }
    }

    private async Task MarkPrintedAsync(Guid jobId, CancellationToken ct)
    {
        try
        {
            var res = await _http.PostAsync($"/admin/print/{jobId}/mark-printed",
                null, ct);

            if (res.IsSuccessStatusCode)
                _logger.LogDebug("Job {JobId} marcado como impresso.", jobId);
            else
                _logger.LogWarning("Falha ao marcar job {JobId}: {Status}", jobId, res.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao marcar job {JobId} como impresso.", jobId);
        }
    }
}
