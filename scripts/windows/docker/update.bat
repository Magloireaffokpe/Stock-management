@echo off
setlocal
chcp 65001 > nul 2>&1
title MICROLOGIS - Mise à jour Docker

for %%I in ("%~dp0..\..\..") do set "PROJECT_ROOT=%%~fI"
pushd "%PROJECT_ROOT%"

echo.
echo  =======================================================
echo     MICROLOGIS STOCK MANAGER - MISE A JOUR
echo  =======================================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Docker Desktop n'est pas installe ou n'est pas demarre.
    echo Demarrez Docker Desktop puis relancez ce script.
    popd
    pause
    exit /b 1
)

echo Reconstruction des images Docker...
docker compose build
if errorlevel 1 (
    echo [ERREUR] La reconstruction des images a echoue.
    popd
    pause
    exit /b 1
)

echo.
echo [SUCCES] Les images ont ete reconstruites avec succes.
echo Vous pouvez maintenant utiliser start.bat pour lancer l'application.
echo.

popd
pause
exit /b 0
