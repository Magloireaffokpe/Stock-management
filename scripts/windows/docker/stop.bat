@echo off
setlocal
chcp 65001 > nul 2>&1
title MICROLOGIS - Arret

for %%I in ("%~dp0..\..\..") do set "PROJECT_ROOT=%%~fI"
pushd "%PROJECT_ROOT%"

echo.
echo  =======================================================
echo     MICROLOGIS STOCK MANAGER - ARRET
echo  =======================================================
echo.
echo  Arret des conteneurs (vos donnees sont conservees)...
docker compose down
echo.
echo  Application arretee.
timeout /t 3 /nobreak >nul
popd
exit /b 0
