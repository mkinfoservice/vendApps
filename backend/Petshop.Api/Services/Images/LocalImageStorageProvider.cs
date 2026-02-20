namespace Petshop.Api.Services.Images;

/// <summary>
/// Armazena imagens localmente em wwwroot/product-images/.
/// Para produção, substituir por S3ImageStorageProvider ou CloudflareR2StorageProvider.
/// </summary>
public class LocalImageStorageProvider : IImageStorageProvider
{
    private readonly IWebHostEnvironment _env;
    private const string SubFolder = "product-images";

    public string ProviderName => "Local";

    public LocalImageStorageProvider(IWebHostEnvironment env)
    {
        _env = env;
    }

    public async Task<string> SaveAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var dir = Path.Combine(_env.WebRootPath, SubFolder);
        Directory.CreateDirectory(dir);

        var ext = Path.GetExtension(fileName);
        var uniqueName = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(dir, uniqueName);

        await using var fs = new FileStream(fullPath, FileMode.Create);
        await stream.CopyToAsync(fs, ct);

        return $"/{SubFolder}/{uniqueName}";
    }

    public Task DeleteAsync(string url, CancellationToken ct)
    {
        var fileName = Path.GetFileName(url);
        var fullPath = Path.Combine(_env.WebRootPath, SubFolder, fileName);

        if (File.Exists(fullPath))
            File.Delete(fullPath);

        return Task.CompletedTask;
    }
}
