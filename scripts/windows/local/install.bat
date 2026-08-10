@echo off
setlocal
chcp 65001 > nul 2>&1
title MICROLOGIS - Installation locale

for %%I in ("%~dp0..\..\..") do set "PROJECT_ROOT=%%~fI"
pushd "%PROJECT_ROOT%"

echo.
echo  =======================================================
echo     MICROLOGIS STOCK MANAGER - INSTALLATION LOCALE
echo  =======================================================
echo.

py -3 --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python 3 n'est pas disponible avec la commande "py -3".
    echo Installez Python 3.12 puis relancez ce script.
    popd
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js et npm sont requis.
    echo Installez Node.js LTS puis relancez ce script.
    popd
    pause
    exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo Creation de l'environnement Python...
    py -3 -m venv backend\.venv
    if errorlevel 1 goto :error
)

echo Installation des dependances Python...
call "backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto :error
call "backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto :error

echo Installation des dependances frontend...
pushd frontend
call npm ci
if errorlevel 1 (
    popd
    goto :error
)
popd

echo Application des migrations et creation du compte administrateur...
pushd backend
call ".venv\Scripts\python.exe" manage.py migrate
if errorlevel 1 (
    popd
    goto :error
)
call ".venv\Scripts\python.exe" manage.py setup_admin
if errorlevel 1 (
    popd
    goto :error
)
popd

echo.
echo Installation terminee. Lancez maintenant start.bat.
popd
pause
exit /b 0

:error
echo.
echo [ERREUR] L'installation locale a echoue.
popd
pause
exit /b 1
