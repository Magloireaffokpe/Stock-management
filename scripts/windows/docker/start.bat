@echo off
setlocal
chcp 65001 > nul 2>&1
title MICROLOGIS - Demarrage Docker

for %%I in ("%~dp0..\..\..") do set "PROJECT_ROOT=%%~fI"
pushd "%PROJECT_ROOT%"

echo.
echo  =======================================================
echo     MICROLOGIS STOCK MANAGER - MODE DOCKER
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

if not exist "backend\db.sqlite3" type nul > "backend\db.sqlite3"

echo Demarrage des conteneurs...
docker compose up --build -d
if errorlevel 1 (
    echo [ERREUR] Le demarrage Docker a echoue.
    popd
    pause
    exit /b 1
)

echo.
echo Application disponible sur : http://localhost
timeout /t 3 /nobreak >nul
start "" "http://localhost"
echo.
popd
exit /b 0
