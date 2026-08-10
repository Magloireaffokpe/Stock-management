@echo off
setlocal
chcp 65001 > nul 2>&1
title MICROLOGIS - Demarrage local

for %%I in ("%~dp0..\..\..") do set "PROJECT_ROOT=%%~fI"

if not exist "%PROJECT_ROOT%\backend\.venv\Scripts\python.exe" (
    echo [ERREUR] Installation absente. Executez d'abord install.bat.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js et npm sont requis. Executez install.bat apres avoir installe Node.js.
    pause
    exit /b 1
)

call "%~dp0stop.bat" >nul 2>&1

echo Demarrage du backend et du frontend dans deux terminaux...
start "MICROLOGIS Local - Backend" /D "%PROJECT_ROOT%\backend" cmd /k ".venv\Scripts\python.exe -m daphne -b 127.0.0.1 -p 8000 config.asgi:application"
start "MICROLOGIS Local - Frontend" /D "%PROJECT_ROOT%\frontend" cmd /k "npm run dev -- --host 127.0.0.1"

echo Attente du demarrage des services...
timeout /t 5 /nobreak >nul
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if errorlevel 1 echo [ATTENTION] Le backend n'est pas encore pret. Consultez son terminal.
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if errorlevel 1 echo [ATTENTION] Le frontend n'est pas encore pret. Consultez son terminal.
start "" "http://localhost:5173"
echo Application ouverte dans votre navigateur : http://localhost:5173
exit /b 0
