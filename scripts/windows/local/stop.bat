@echo off
setlocal
chcp 65001 > nul 2>&1
title MICROLOGIS - Arret local

echo Arret du backend local (port 8000)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do taskkill /PID %%P /T /F >nul 2>&1

echo Arret du frontend local (port 5173)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5173 .*LISTENING"') do taskkill /PID %%P /T /F >nul 2>&1

taskkill /F /T /IM cmd.exe /FI "WINDOWTITLE eq MICROLOGIS Local - Backend" >nul 2>&1
taskkill /F /T /IM cmd.exe /FI "WINDOWTITLE eq MICROLOGIS Local - Frontend" >nul 2>&1

echo Application locale arretee.
timeout /t 2 /nobreak >nul
exit /b 0
