@echo off
SETLOCAL EnableDelayedExpansion
chcp 65001 > nul 2>&1
title MICROLOGIS Stock Manager

echo.
echo  =======================================================
echo      DEMARRAGE DE MICROLOGIS STOCK MANAGER
echo  =======================================================
echo.

:: Vérification rapide que l'installation a été faite
if not exist "backend\venv\Scripts\activate.bat" (
    echo  [ERREUR] L'installation n'a pas ete effectuee.
    echo  Veuillez d'abord lancer install.bat
    echo.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo  [ERREUR] Les dependances frontend ne sont pas installees.
    echo  Veuillez d'abord lancer install.bat
    echo.
    pause
    exit /b 1
)

:: Démarrer Django en arrière-plan (avec le venv activé)
echo  [1/3] Demarrage du serveur backend (Django)...
start "MICROLOGIS Backend" /d "%~dp0backend" cmd /k "call venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"

:: Attendre que Django soit prêt
echo        Attente du demarrage du backend...
timeout /t 5 /nobreak > nul

:: Démarrer React Vite
echo  [2/3] Demarrage du frontend (Vite)...
start "MICROLOGIS Frontend" /d "%~dp0frontend" cmd /k "npm run dev"

:: Attendre que Vite soit prêt
echo        Attente du demarrage du frontend...
timeout /t 5 /nobreak > nul

:: Ouvrir le navigateur
echo  [3/3] Ouverture du navigateur...
start "" "http://localhost:5173"

echo.
echo  =======================================================
echo     APPLICATION DEMARREE AVEC SUCCES
echo  =======================================================
echo.
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:8000
echo.
echo  Pour arreter : fermez les deux fenetres noires.
echo.
ENDLOCAL
pause
