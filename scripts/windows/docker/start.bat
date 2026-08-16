@echo off
setlocal
chcp 65001 > nul 2>&1
title MICROLOGIS - Demarrage

for %%I in ("%~dp0..\..\..") do set "PROJECT_ROOT=%%~fI"
pushd "%PROJECT_ROOT%"

echo.
echo  =======================================================
echo     MICROLOGIS STOCK MANAGER - DEMARRAGE
echo  =======================================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo  [ERREUR] Docker n'est pas installe ou n'est pas demarre.
    echo  Demarrez Docker Desktop puis relancez ce script.
    timeout /t 10 /nobreak >nul
    popd
    exit /b 1
)

set "DC=docker compose"
docker compose version >nul 2>&1
if errorlevel 1 (
    set "DC=docker-compose"
    docker-compose version >nul 2>&1
    if errorlevel 1 (
        echo  [ERREUR] Docker Compose n'est pas installe.
        echo  Reinstallez Docker Desktop puis relancez ce script.
        timeout /t 10 /nobreak >nul
        popd
        exit /b 1
    )
)

for %%d in (data media factures backup staticfiles) do if not exist "backend\%%d" mkdir "backend\%%d"

echo  Demarrage de l'application...
%DC% up -d
if errorlevel 1 (
    echo  [ERREUR] Le demarrage a echoue.
    echo  Verifiez avec : %DC% ps
    timeout /t 10 /nobreak >nul
    popd
    exit /b 1
)

echo.
echo  Attente du demarrage (quelques secondes)...
set /a tries=0
:waitloop
set /a tries+=1
curl -s -o nul http://localhost/
if not errorlevel 1 goto ready
if %tries% geq 30 (
    echo  [ATTENTION] L'application ne repond pas encore.
    echo  Verifiez avec : %DC% ps
    goto ready
)
timeout /t 2 /nobreak >nul
goto waitloop

:ready
echo.
echo  =======================================================
echo     MICROLOGIS EST PRET !
echo  =======================================================
echo.
echo   Application    : http://localhost
echo   Administration : http://localhost/admin/
echo.
echo   Connectez-vous avec le compte administrateur
echo   qui vous a ete communique.
echo.
echo   Vos donnees sont conservees dans le dossier backend\data
echo.
start "" "http://localhost"
timeout /t 5 /nobreak >nul
popd
exit /b 0
