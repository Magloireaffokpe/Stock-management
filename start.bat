@echo off
chcp 65001 > nul 2>&1
title Lancement - MICROLOGIS Stock Manager

echo.
echo  =======================================================
echo     LANCEMENT DE MICROLOGIS STOCK MANAGER (DOCKER)
echo  =======================================================
echo.

:: Verification de Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERREUR] Docker n'est pas installe ou n'est pas lance.
    echo  Veuillez installer Docker Desktop : https://www.docker.com/products/docker-desktop/
    echo  Et assurez-vous qu'il est en cours d'execution.
    echo.
    pause
    exit /b 1
)

:: Prevention du bug de volume Docker avec SQLite
if not exist "backend\db.sqlite3" (
    echo Creation du fichier de base de donnees initial...
    type nul > "backend\db.sqlite3"
)

echo Demarrage des conteneurs (Backend, Frontend, Cache Redis)...
docker compose up --build -d

echo.
echo  =======================================================
echo     APPLICATION PRETE !
echo  =======================================================
echo.
echo  L'application est desormais accessible sur : http://localhost
echo.
pause
