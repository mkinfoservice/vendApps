using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace Petshop.Api.Services.Sync;

/// <summary>
/// Resolve caminhos de arquivos de importação para o ambiente de execução do backend.
/// </summary>
public static class SyncFilePathResolver
{
    private static readonly Regex WindowsAbsolutePathRegex =
        new(@"^[a-zA-Z]:[\\/]", RegexOptions.Compiled);

    public static string ResolveDumpPath(string rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath))
            throw new InvalidOperationException("FilePath não configurado para modo dump.");

        var path = rawPath.Trim().Trim('"');

        if (Uri.TryCreate(path, UriKind.Absolute, out var uri) && uri.IsFile)
            path = uri.LocalPath;

        // Já é absoluto no ambiente atual (Windows ou Linux)
        if (Path.IsPathRooted(path) && !IsWindowsAbsolutePathOnUnix(path))
            return path;

        // Caminho tipo C:\... recebido em backend Linux/container
        if (IsWindowsAbsolutePathOnUnix(path))
        {
            var translated = TryTranslateWindowsPathToLinuxMount(path);
            if (translated != null)
                return translated;

            throw new FileNotFoundException(
                $"Caminho Windows detectado no servidor Linux: '{path}'. " +
                "Faça upload do dump para o servidor/container ou monte um volume (ex.: /data/imports) e informe esse caminho.");
        }

        // Relativo: resolve a partir da pasta atual do processo (ex.: /app)
        return Path.GetFullPath(path);
    }

    private static bool IsWindowsAbsolutePathOnUnix(string path) =>
        !RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
        WindowsAbsolutePathRegex.IsMatch(path);

    private static string? TryTranslateWindowsPathToLinuxMount(string windowsPath)
    {
        var driveLetter = char.ToLowerInvariant(windowsPath[0]);
        var relative = windowsPath[2..]
            .Replace('\\', '/')
            .TrimStart('/');

        var candidates = new[]
        {
            $"/run/desktop/mnt/host/{driveLetter}/{relative}",
            $"/host_mnt/{driveLetter}/{relative}",
            $"/mnt/{driveLetter}/{relative}",
        };

        return candidates.FirstOrDefault(File.Exists);
    }
}
