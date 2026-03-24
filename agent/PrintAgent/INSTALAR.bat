@echo off
:: Eleva para Administrador automaticamente se necessario
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Ja esta como admin — executa o script de instalacao
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
