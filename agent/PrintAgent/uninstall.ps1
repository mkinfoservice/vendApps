#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Remove o vendApps Print Agent do sistema.
#>

$ServiceName = "vendAppsPrintAgent"
$InstallDir  = "C:\Program Files\vendApps\PrintAgent"

Write-Host ""
Write-Host "  Removendo vendApps Print Agent..." -ForegroundColor Yellow
Write-Host ""

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.Status -eq "Running") {
        Write-Host "  Parando servico..." -NoNewline
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 2
        Write-Host " OK" -ForegroundColor Green
    }
    Write-Host "  Removendo servico..." -NoNewline
    & sc.exe delete $ServiceName | Out-Null
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host "  Servico nao encontrado (ja removido)." -ForegroundColor DarkGray
}

if (Test-Path $InstallDir) {
    Write-Host "  Removendo arquivos de $InstallDir..." -NoNewline
    Remove-Item -Recurse -Force $InstallDir
    Write-Host " OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Print Agent removido com sucesso." -ForegroundColor Green
Write-Host ""
