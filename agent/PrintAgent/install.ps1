#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instala o vendApps Print Agent como Windows Service.
    Execute este script como Administrador.
#>

$ErrorActionPreference = "Stop"
$InstallDir = "C:\Program Files\vendApps\PrintAgent"
$ServiceName = "vendAppsPrintAgent"
$ServiceDisplay = "vendApps Print Agent"

# ── Banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     vendApps - Instalador Print Agent    ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Verifica .NET 8 ───────────────────────────────────────────────────────────
Write-Host "  Verificando .NET SDK..." -NoNewline
try {
    $dotnetVer = & dotnet --version 2>$null
    if (-not $dotnetVer -or -not $dotnetVer.StartsWith("8")) {
        Write-Host " FALTANDO" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Instale o .NET 8 SDK em: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
        exit 1
    }
    Write-Host " $dotnetVer OK" -ForegroundColor Green
} catch {
    Write-Host " NAO ENCONTRADO" -ForegroundColor Red
    exit 1
}

# ── Configuracoes com preset ───────────────────────────────────────────────────
Write-Host ""
Write-Host "  ── CONFIGURACAO ─────────────────────────────" -ForegroundColor Yellow
Write-Host ""

$ApiUrl = Read-Host "  URL da API [https://vendapps.onrender.com]"
if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $ApiUrl = "https://vendapps.onrender.com"
}

$Username = Read-Host "  Usuario admin"
$PasswordRaw = Read-Host "  Senha admin" -AsSecureString
$Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($PasswordRaw))

# ── Lista impressoras instaladas ──────────────────────────────────────────────
Write-Host ""
Write-Host "  ── IMPRESSORA ───────────────────────────────" -ForegroundColor Yellow
Write-Host ""

$printers = Get-Printer | Select-Object -ExpandProperty Name
$defaultPrinter = (Get-CimInstance -ClassName Win32_Printer | Where-Object Default -eq $true).Name

if ($printers.Count -eq 0) {
    Write-Host "  Nenhuma impressora encontrada. Sera usada a padrao do sistema." -ForegroundColor Yellow
    $SelectedPrinter = ""
} else {
    Write-Host "  Impressoras instaladas:" -ForegroundColor White
    $i = 0
    foreach ($p in $printers) {
        $tag = if ($p -eq $defaultPrinter) { " (padrao)" } else { "" }
        Write-Host "    [$i] $p$tag"
        $i++
    }
    Write-Host "    [ENTER] Usar impressora padrao do sistema ($defaultPrinter)"
    Write-Host ""

    $choice = Read-Host "  Escolha o numero da impressora"

    if ([string]::IsNullOrWhiteSpace($choice)) {
        $SelectedPrinter = ""   # vazio = usa padrao do Windows
        Write-Host "  Usando impressora padrao: $defaultPrinter" -ForegroundColor Green
    } elseif ($choice -match '^\d+$' -and [int]$choice -lt $printers.Count) {
        $SelectedPrinter = $printers[[int]$choice]
        Write-Host "  Impressora selecionada: $SelectedPrinter" -ForegroundColor Green
    } else {
        Write-Host "  Opcao invalida. Usando impressora padrao." -ForegroundColor Yellow
        $SelectedPrinter = ""
    }
}

# ── Escreve appsettings.json ──────────────────────────────────────────────────
Write-Host ""
Write-Host "  Configurando appsettings.json..." -NoNewline

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppSettings = @{
    PrintAgent = @{
        ApiBaseUrl  = $ApiUrl
        Username    = $Username
        Password    = $Password
        HubPath     = "/hubs/print"
        PrinterName = $SelectedPrinter
    }
    Logging = @{
        LogLevel = @{
            Default = "Information"
            "Microsoft.AspNetCore.SignalR" = "Warning"
            PrintAgent = "Information"
        }
    }
} | ConvertTo-Json -Depth 5

Set-Content -Path "$ScriptDir\appsettings.json" -Value $AppSettings -Encoding UTF8
Write-Host " OK" -ForegroundColor Green

# ── Build e Publish ───────────────────────────────────────────────────────────
Write-Host "  Compilando e publicando..." -NoNewline

if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir | Out-Null
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Push-Location $ScriptDir
try {
    $buildOutput = & dotnet publish `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -o $InstallDir `
        2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host " FALHOU" -ForegroundColor Red
        Write-Host $buildOutput
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host " OK" -ForegroundColor Green

# Copia o appsettings configurado para o diretorio de instalacao
Copy-Item "$ScriptDir\appsettings.json" "$InstallDir\appsettings.json" -Force

# ── Instala o Servico Windows ─────────────────────────────────────────────────
Write-Host "  Instalando servico Windows..." -NoNewline

$ExePath = "$InstallDir\PrintAgent.exe"

# Remove servico anterior se existir
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -eq "Running") {
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 2
    }
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
}

& sc.exe create $ServiceName `
    binPath= "`"$ExePath`"" `
    DisplayName= $ServiceDisplay `
    start= auto | Out-Null

& sc.exe description $ServiceName `
    "Recebe pedidos do sistema vendApps e imprime silenciosamente na impressora local." | Out-Null

Write-Host " OK" -ForegroundColor Green

# ── Inicia o Servico ──────────────────────────────────────────────────────────
Write-Host "  Iniciando servico..." -NoNewline
Start-Service -Name $ServiceName
Start-Sleep -Seconds 2

$svc = Get-Service -Name $ServiceName
if ($svc.Status -eq "Running") {
    Write-Host " RODANDO" -ForegroundColor Green
} else {
    Write-Host " ATENCAO: status = $($svc.Status)" -ForegroundColor Yellow
}

# ── Resumo ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║          Instalacao concluida!           ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Servico : $ServiceName" -ForegroundColor White
Write-Host "  Status  : $($svc.Status)" -ForegroundColor White
Write-Host "  API     : $ApiUrl" -ForegroundColor White
if ($SelectedPrinter) {
    Write-Host "  Impress.: $SelectedPrinter" -ForegroundColor White
} else {
    Write-Host "  Impress.: $defaultPrinter (padrao do sistema)" -ForegroundColor White
}
Write-Host ""
Write-Host "  Comandos uteis:" -ForegroundColor DarkGray
Write-Host "    Parar  : Stop-Service $ServiceName" -ForegroundColor DarkGray
Write-Host "    Iniciar: Start-Service $ServiceName" -ForegroundColor DarkGray
Write-Host "    Logs   : Get-EventLog -LogName Application -Source $ServiceName -Newest 20" -ForegroundColor DarkGray
Write-Host "    Remover: .\uninstall.ps1" -ForegroundColor DarkGray
Write-Host ""
