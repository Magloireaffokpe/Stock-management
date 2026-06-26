@echo off
chcp 65001 > nul 2>&1
title Arrêt de MICROLOGIS Stock Manager

echo.
echo  =======================================================
echo       ARRET DE MICROLOGIS STOCK MANAGER
echo  =======================================================
echo.
echo  [1/2] Fermeture du serveur Backend...
taskkill /f /t /fi "WINDOWTITLE eq MICROLOGIS Backend*" >nul 2>&1

echo  [2/2] Fermeture du serveur Frontend...
taskkill /f /t /fi "WINDOWTITLE eq MICROLOGIS Frontend*" >nul 2>&1

:: Sécurité supplémentaire pour tuer d'éventuels processus Python liés au projet
taskkill /f /t /im "python.exe" /fi "WINDOWTITLE eq MICROLOGIS*" >nul 2>&1

echo.
echo  =======================================================
echo     APPLICATION ARRETEE AVEC SUCCES !
echo  =======================================================
echo.
echo  [INFO] Les processus en arriere-plan ont ete fermes.
echo  [INFO] Veuillez fermer l'onglet dans votre navigateur manuellement.
echo.
pause
