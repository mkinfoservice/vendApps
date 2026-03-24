#Requires -RunAsAdministrator
param()

$ErrorActionPreference = "Stop"
$InstallDir    = "C:\Program Files\vendApps\PrintAgent"
$ServiceName   = "vendAppsPrintAgent"
$ServiceDisplay = "vendApps Print Agent"

Clear-Host
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "     vendApps - Instalador Print Agent" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# -- Verifica .NET 8 -----------------------------------------------------------
Write-Host "  Verificando .NET SDK..." -NoNewline
try {
    $dotnetVer = & dotnet --version 2>$null
    if (-not $dotnetVer -or -not $dotnetVer.StartsWith("8")) {
        Write-Host " FALTANDO" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Instale o .NET 8 SDK:" -ForegroundColor Yellow
        Write-Host "  https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
        Read-Host "`n  Pressione Enter para sair"
        exit 1
    }
    Write-Host " $dotnetVer OK" -ForegroundColor Green
} catch {
    Write-Host " NAO ENCONTRADO" -ForegroundColor Red
    Read-Host "`n  Pressione Enter para sair"
    exit 1
}

# -- Configuracao --------------------------------------------------------------
Write-Host ""
Write-Host "  -- CONFIGURACAO ------------------------------------" -ForegroundColor Yellow
Write-Host ""

$ApiUrl = Read-Host "  URL da API [https://vendapps.onrender.com]"
if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $ApiUrl = "https://vendapps.onrender.com"
}

$Username = Read-Host "  Usuario admin"

$PasswordRaw = Read-Host "  Senha admin" -AsSecureString
$Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($PasswordRaw))

# -- Impressoras ---------------------------------------------------------------
Write-Host ""
Write-Host "  -- IMPRESSORA --------------------------------------" -ForegroundColor Yellow
Write-Host ""

$printers = @(Get-Printer | Select-Object -ExpandProperty Name)
$defaultPrinter = (Get-CimInstance -ClassName Win32_Printer |
    Where-Object { $_.Default -eq $true } |
    Select-Object -First 1).Name

$SelectedPrinter = ""

if ($printers.Count -eq 0) {
    Write-Host "  Nenhuma impressora encontrada. Usando padrao do sistema." -ForegroundColor Yellow
} else {
    Write-Host "  Impressoras instaladas:" -ForegroundColor White
    for ($i = 0; $i -lt $printers.Count; $i++) {
        $tag = if ($printers[$i] -eq $defaultPrinter) { " <- padrao" } else { "" }
        Write-Host "    [$i] $($printers[$i])$tag"
    }
    Write-Host "    [ENTER] Usar impressora padrao do sistema"
    Write-Host ""

    $choice = Read-Host "  Escolha o numero da impressora"

    if ([string]::IsNullOrWhiteSpace($choice)) {
        $SelectedPrinter = ""
        Write-Host "  Usando impressora padrao: $defaultPrinter" -ForegroundColor Green
    } elseif ($choice -match '^\d+$' -and [int]$choice -lt $printers.Count) {
        $SelectedPrinter = $printers[[int]$choice]
        Write-Host "  Impressora: $SelectedPrinter" -ForegroundColor Green
    } else {
        Write-Host "  Opcao invalida. Usando impressora padrao." -ForegroundColor Yellow
        $SelectedPrinter = ""
    }
}

# -- Escreve appsettings.json --------------------------------------------------
Write-Host ""
Write-Host "  Gravando configuracoes..." -NoNewline

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$AppSettings = @"
{
  "PrintAgent": {
    "ApiBaseUrl":   "$ApiUrl",
    "Username":     "$Username",
    "Password":     "$Password",
    "HubPath":      "/hubs/print",
    "PrinterName":  "$SelectedPrinter"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore.SignalR": "Warning",
      "PrintAgent": "Information"
    }
  }
}
"@

Set-Content -Path "$ScriptDir\appsettings.json" -Value $AppSettings -Encoding UTF8
Write-Host " OK" -ForegroundColor Green

# -- Publish -------------------------------------------------------------------
Write-Host "  Compilando e publicando (pode levar 1-2 min)..." -NoNewline

if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir | Out-Null
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Push-Location $ScriptDir
try {
    $out = & dotnet publish -c Release -r win-x64 --self-contained true -o $InstallDir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host " FALHOU" -ForegroundColor Red
        Write-Host $out
        Read-Host "`n  Pressione Enter para sair"
        exit 1
    }
} finally {
    Pop-Location
}

Copy-Item "$ScriptDir\appsettings.json" "$InstallDir\appsettings.json" -Force
Write-Host " OK" -ForegroundColor Green

# -- Instala servico Windows ---------------------------------------------------
Write-Host "  Instalando servico Windows..." -NoNewline

$ExePath = "$InstallDir\PrintAgent.exe"

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -eq "Running") {
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 2
    }
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
}

& sc.exe create $ServiceName binPath= "`"$ExePath`"" DisplayName= $ServiceDisplay start= auto | Out-Null
& sc.exe description $ServiceName "Imprime pedidos do vendApps silenciosamente na impressora local." | Out-Null

Write-Host " OK" -ForegroundColor Green

# -- Inicia --------------------------------------------------------------------
Write-Host "  Iniciando servico..." -NoNewline
Start-Service -Name $ServiceName
Start-Sleep -Seconds 2

$svc = Get-Service -Name $ServiceName
if ($svc.Status -eq "Running") {
    Write-Host " RODANDO" -ForegroundColor Green
} else {
    Write-Host " Status: $($svc.Status)" -ForegroundColor Yellow
}

# -- Resumo --------------------------------------------------------------------
$impressora = if ($SelectedPrinter) { $SelectedPrinter } else { "$defaultPrinter (padrao)" }

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "        Instalacao concluida com sucesso!" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Servico   : $ServiceName"
Write-Host "  Status    : $($svc.Status)"
Write-Host "  API       : $ApiUrl"
Write-Host "  Impressora: $impressora"
Write-Host ""
Write-Host "  Para remover: execute DESINSTALAR.bat" -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Pressione Enter para fechar"
