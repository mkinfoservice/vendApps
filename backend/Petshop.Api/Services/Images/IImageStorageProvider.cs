namespace Petshop.Api.Services.Images;

public interface IImageStorageProvider
{
    /// <summary>Salva a imagem e retorna a URL pública.</summary>
    Task<string> SaveAsync(Stream stream, string fileName, string contentType, CancellationToken ct);

    Task DeleteAsync(string url, CancellationToken ct);

    string ProviderName { get; }
}
