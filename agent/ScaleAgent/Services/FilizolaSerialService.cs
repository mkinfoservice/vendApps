using System.IO.Ports;
using System.Text;
using ScaleAgent.Models;

namespace ScaleAgent.Services;

/// <summary>
/// Implementa o protocolo serial Filizola P/Marte para programação de produtos.
///
/// Protocolo RS-232 Filizola (simplificado):
///   - Baudrate padrão: 9600, 8N1
///   - Envio de produto: ENQ → aguarda ACK → envia frame → aguarda ACK final
///   - Frame de produto: STX | código(5) | nome(22) | preço(9) | ETX | LRC
///
/// Para modelos diferentes (FilizolaST, TolVdo, Generic), sobrescreva SendProductAsync.
/// </summary>
public class FilizolaSerialService : IDisposable
{
    private readonly ILogger<FilizolaSerialService> _logger;

    // Constantes de protocolo
    private const byte ENQ = 0x05;
    private const byte ACK = 0x06;
    private const byte STX = 0x02;
    private const byte ETX = 0x03;
    private const byte NAK = 0x15;

    public FilizolaSerialService(ILogger<FilizolaSerialService> logger) => _logger = logger;

    /// <summary>
    /// Envia lista de produtos para a balança via porta serial.
    /// Retorna true se todos foram enviados com sucesso.
    /// </summary>
    public async Task<bool> SyncProductsAsync(
        string portName,
        int baudRate,
        IEnumerable<ScaleProductPayload> products,
        CancellationToken ct)
    {
        using var port = new SerialPort(portName, baudRate, Parity.None, 8, StopBits.One)
        {
            ReadTimeout  = 3000,
            WriteTimeout = 3000,
            Encoding     = Encoding.GetEncoding("ISO-8859-1"),
        };

        try
        {
            port.Open();
            _logger.LogInformation("Porta {Port} aberta @ {Baud} bps.", portName, baudRate);

            foreach (var product in products)
            {
                ct.ThrowIfCancellationRequested();

                var ok = await SendProductAsync(port, product, ct);
                if (!ok)
                {
                    _logger.LogWarning("Falha ao enviar produto {Code}.", product.ScaleProductCode);
                    // Continua tentando os próximos
                }

                // Intervalo entre envios para não sobrecarregar a balança
                await Task.Delay(50, ct);
            }

            return true;
        }
        catch (OperationCanceledException)
        {
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro na comunicação serial com {Port}.", portName);
            return false;
        }
        finally
        {
            if (port.IsOpen) port.Close();
        }
    }

    /// <summary>
    /// Envia um produto para a balança Filizola P.
    /// Formato do frame: STX | código(5 dígitos) | nome(22 chars) | preço/kg(9 dígitos) | ETX | LRC
    /// </summary>
    private async Task<bool> SendProductAsync(SerialPort port, ScaleProductPayload p, CancellationToken ct)
    {
        // 1. Sinaliza intenção de envio
        port.Write(new[] { ENQ }, 0, 1);

        // 2. Aguarda ACK da balança
        if (!await WaitAckAsync(port, ct)) return false;

        // 3. Monta frame
        var code    = p.ScaleProductCode.PadLeft(5, '0')[..5];
        var name    = p.Name.PadRight(22)[..22];
        var price   = (p.PricePerKgCents / 100m).ToString("000000.00").Replace(".", "");
        if (price.Length > 9) price = price[..9];
        price = price.PadLeft(9, '0');

        var payload = Encoding.GetEncoding("ISO-8859-1").GetBytes(code + name + price);

        var frame = new byte[1 + payload.Length + 1];
        frame[0] = STX;
        Array.Copy(payload, 0, frame, 1, payload.Length);
        frame[^1] = ETX;

        // 4. Calcula LRC (XOR de todos os bytes do frame, exceto STX)
        byte lrc = 0;
        for (int i = 1; i < frame.Length; i++) lrc ^= frame[i];

        var toSend = new byte[frame.Length + 1];
        Array.Copy(frame, toSend, frame.Length);
        toSend[^1] = lrc;

        port.Write(toSend, 0, toSend.Length);

        // 5. Aguarda ACK final
        return await WaitAckAsync(port, ct);
    }

    private static async Task<bool> WaitAckAsync(SerialPort port, CancellationToken ct)
    {
        return await Task.Run(() =>
        {
            try
            {
                var b = port.ReadByte();
                return b == ACK;
            }
            catch { return false; }
        }, ct);
    }

    public void Dispose() { }
}
