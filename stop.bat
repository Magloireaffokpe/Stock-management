@echo off
echo Arrêt de MICROLOGIS Stock Manager...
taskkill /f /fi "WINDOWTITLE eq MICROLOGIS Backend*" 2>nul
taskkill /f /fi "WINDOWTITLE eq MICROLOGIS Frontend*" 2>nul
taskkill /f /im "python.exe" /fi "WINDOWTITLE eq MICROLOGIS*" 2>nul
echo Arrêté.
pause
