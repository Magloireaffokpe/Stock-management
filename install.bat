@echo off
chcp 65001 > nul
title Installation - MICROLOGIS Stock Manager

echo =======================================================
echo     INSTALLATION DE MICROLOGIS STOCK MANAGER
echo =======================================================
echo.

:: 1. Vérification de Python
echo [1/5] Vérification de Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Python n'est pas installé ou n'est pas ajouté au PATH.
    echo Veuillez installer Python (version 3.10 ou supérieure) : https://www.python.org/downloads/
    goto error
)
echo ✓ Python est installé.
echo.

:: 2. Vérification de Node.js et NPM
echo [2/5] Vérification de Node.js et NPM...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installé ou n'est pas ajouté au PATH.
    echo Veuillez installer Node.js (version LTS) : https://nodejs.org/
    goto error
)
echo ✓ Node.js et NPM sont installés.
echo.

:: 3. Création de l'environnement virtuel Python (Backend)
echo [3/5] Création de l'environnement virtuel Python...
if not exist "backend\venv" (
    python -m venv backend\venv
    if %errorlevel% neq 0 (
        echo [ERREUR] Impossible de créer l'environnement virtuel.
        goto error
    )
    echo ✓ Environnement virtuel créé avec succès.
) else (
    echo ✓ Environnement virtuel déjà existant.
)
echo.

:: Activation et installation des dépendances backend
echo Installation des dépendances backend...
call backend\venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERREUR] Échec de l'installation des dépendances Python.
    goto error
)
echo ✓ Dépendances backend installées.
echo.

:: Migrations et initialisation de la base de données
echo Préparation de la base de données...
python backend\manage.py migrate
if %errorlevel% neq 0 (
    echo [ERREUR] Échec des migrations de base de données.
    goto error
)
echo ✓ Migrations terminées.

if exist "backend\initial_data.json" (
    echo Chargement des données initiales...
    :: Le fichier est cherché relativement au dossier de manage.py (backend\)
    python backend\manage.py loaddata initial_data.json
    if %errorlevel% neq 0 (
        echo [AVERTISSEMENT] Données initiales non chargées (peut-etre deja chargees).
    ) else (
        echo ✓ Données initiales chargées.
    )
)

:: Création du compte administrateur
echo Création du compte administrateur...
python backend\manage.py shell -c "from django.contrib.auth import get_user_model; U=get_user_model(); U.objects.filter(username='admin').exists() or U.objects.create_superuser('admin','admin@micrologis.bj','micrologis2026',role='admin'); print('Admin OK')"
echo ✓ Compte admin prêt  (login: admin / mot de passe: micrologis2026)
echo.
echo.

:: 4. Installation des dépendances frontend
echo [4/5] Installation des dépendances frontend (npm install)...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [ERREUR] Échec de l'installation des modules Node.js.
    cd ..
    goto error
)
cd ..
echo ✓ Dépendances frontend installées.
echo.

:: 5. Fin de l'installation
echo [5/5] Finalisation...
echo =======================================================
echo    ✓ INSTALLATION TERMINÉE AVEC SUCCÈS !
echo =======================================================
echo.
echo  Vous pouvez démarrer l'application en lançant :
echo    - start.bat (ou double-clic dessus)
echo.
pause
exit /b 0

:error
echo.
echo =======================================================
echo   [ERREUR] L'installation a échoué.
echo   Veuillez vérifier les messages ci-dessus.
echo =======================================================
echo.
pause
exit /b 1
