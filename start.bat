@echo off
chcp 65001 > nul
title MICROLOGIS Stock Manager

echo.
echo  Démarrage de MICROLOGIS Stock Manager...
echo.

:: Démarrer Django en arrière-plan
start "MICROLOGIS Backend" cmd /k "cd /d %~dp0backend && python manage.py runserver 0.0.0.0:8000"

:: Attendre que Django soit prêt
timeout /t 3 /nobreak > nul

:: Démarrer React Vite
start "MICROLOGIS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Attendre que Vite soit prêt
timeout /t 5 /nobreak > nul

:: Ouvrir le navigateur
start "" "http://localhost:5173"

echo  ✓ Application démarrée sur http://localhost:5173
echo  ✓ API backend sur http://localhost:8000
echo.
echo  Fermez les deux fenêtres noires pour arrêter.
echo.
