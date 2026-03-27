@echo off
echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo Gerando executavel...
pyinstaller --onefile --windowed --name "VendApps Imagens" enrich_images_gui.py

echo.
echo Pronto! O exe esta em: dist\VendApps Imagens.exe
pause
