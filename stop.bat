@echo off
chcp 65001 > nul 2>&1
title Arret de MICROLOGIS Stock Manager

echo.
echo  =======================================================
echo       ARRET DE MICROLOGIS STOCK MANAGER (DOCKER)
echo  =======================================================
echo.
echo  [INFO] Arret et suppression des conteneurs en cours...
docker compose down

echo.
echo  =======================================================
echo     APPLICATION ARRETEE AVEC SUCCES !
echo  =======================================================
echo.
echo  [INFO] Tous les services ont ete arretes proprement.
echo  [INFO] Veuillez fermer l'onglet dans votre navigateur manuellement.
echo.
pause
