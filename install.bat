@echo off
SETLOCAL EnableDelayedExpansion
chcp 65001 > nul 2>&1
title Installation - MICROLOGIS Stock Manager

echo.
echo  =======================================================
echo     INSTALLATION DE MICROLOGIS STOCK MANAGER
echo  =======================================================
echo.

:: ─────────────────────────────────────────────────────────
:: Détection de la commande Python (python ou py)
:: ─────────────────────────────────────────────────────────
set "PYTHON_CMD="

python --version >nul 2>&1
if !errorlevel! equ 0 (
    set "PYTHON_CMD=python"
    goto :python_found
)

py --version >nul 2>&1
if !errorlevel! equ 0 (
    set "PYTHON_CMD=py"
    goto :python_found
)

echo.
echo  [ERREUR] Python n'est pas detecte sur ce PC.
echo  Veuillez installer Python 3.10+ et l'ajouter au PATH.
echo  Telechargement : https://www.python.org/downloads/
echo.
goto :error

:python_found
for /f "tokens=*" %%V in ('!PYTHON_CMD! --version 2^>^&1') do set "PY_VER=%%V"
echo  [OK] %PY_VER% detecte (commande: !PYTHON_CMD!)

:: ─────────────────────────────────────────────────────────
:: Vérification de Node.js
:: ─────────────────────────────────────────────────────────
node -v >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo  [ERREUR] Node.js n'est pas detecte sur ce PC.
    echo  Veuillez installer Node.js LTS : https://nodejs.org/
    echo.
    goto :error
)
for /f "tokens=*" %%V in ('node -v 2^>^&1') do set "NODE_VER=%%V"
echo  [OK] Node.js %NODE_VER% detecte
echo.

:: ─────────────────────────────────────────────────────────
:: ÉTAPE 1 — Environnement virtuel Python
:: ─────────────────────────────────────────────────────────
echo  [1/5] Creation de l'environnement virtuel Python...

if not exist "backend\venv" (
    !PYTHON_CMD! -m venv "backend\venv"
    if !errorlevel! neq 0 (
        echo  [ERREUR] Impossible de creer l'environnement virtuel.
        goto :error
    )
    echo  [OK] Environnement virtuel cree.
) else (
    echo  [OK] Environnement virtuel deja existant.
)
echo.

:: ─────────────────────────────────────────────────────────
:: ÉTAPE 2 — Dépendances backend (pip)
:: ─────────────────────────────────────────────────────────
echo  [2/5] Installation des dependances backend...

call "backend\venv\Scripts\activate.bat"
if !errorlevel! neq 0 (
    echo  [ERREUR] Impossible d'activer l'environnement virtuel.
    goto :error
)

python -m pip install --upgrade pip --quiet >nul 2>&1
pip install -r "backend\requirements.txt" --quiet
if !errorlevel! neq 0 (
    echo  [ERREUR] Echec de l'installation des dependances Python.
    echo  Verifiez le fichier backend\requirements.txt
    goto :error
)
echo  [OK] Dependances backend installees.
echo.

:: ─────────────────────────────────────────────────────────
:: ÉTAPE 3 — Migrations + données initiales
:: ─────────────────────────────────────────────────────────
echo  [3/5] Preparation de la base de donnees...

python "backend\manage.py" migrate --run-syncdb >nul 2>&1
if !errorlevel! neq 0 (
    python "backend\manage.py" migrate
    if !errorlevel! neq 0 (
        echo  [ERREUR] Echec des migrations de base de donnees.
        goto :error
    )
)
echo  [OK] Migrations terminees.

if exist "backend\initial_data.json" (
    echo        Chargement des donnees initiales...
    python "backend\manage.py" loaddata initial_data.json >nul 2>&1
    if !errorlevel! equ 0 (
        echo  [OK] Donnees initiales chargees.
    ) else (
        echo  [INFO] Donnees initiales deja presentes ou non applicables.
    )
)

:: ─────────────────────────────────────────────────────────
:: Création automatique du superuser admin
:: ─────────────────────────────────────────────────────────
echo.
echo        Creation du compte administrateur...

python "backend\manage.py" shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); exists = User.objects.filter(username='admin').exists(); exec('') if exists else User.objects.create_superuser(username='admin', email='admin@micrologis.local', password='micrologis2026', role='admin', first_name='Admin', last_name='MICROLOGIS'); print('DEJA_EXISTANT' if exists else 'CREE')" 2>nul | findstr /C:"CREE" >nul 2>&1

if !errorlevel! equ 0 (
    echo  [OK] Compte administrateur cree avec succes.
    echo.
    echo  -------------------------------------------------------
    echo    IDENTIFIANTS ADMINISTRATEUR
    echo    Nom d'utilisateur : admin
    echo    Mot de passe      : micrologis2026
    echo  -------------------------------------------------------
    echo    IMPORTANT : Changez ce mot de passe apres connexion !
    echo  -------------------------------------------------------
    echo.
) else (
    echo  [OK] Compte administrateur deja existant.
    echo.
)

:: ─────────────────────────────────────────────────────────
:: ÉTAPE 4 — Dépendances frontend (npm)
:: ─────────────────────────────────────────────────────────
echo  [4/5] Installation des dependances frontend...

pushd "frontend"
if !errorlevel! neq 0 (
    echo  [ERREUR] Dossier frontend introuvable.
    goto :error
)

call npm install --loglevel=error
if !errorlevel! neq 0 (
    echo  [ERREUR] Echec de l'installation des modules Node.js.
    popd
    goto :error
)
popd

echo  [OK] Dependances frontend installees.
echo.

:: ─────────────────────────────────────────────────────────
:: ÉTAPE 5 — Terminé
:: ─────────────────────────────────────────────────────────
echo  [5/5] Finalisation...
echo.
echo  =======================================================
echo     INSTALLATION TERMINEE AVEC SUCCES !
echo  =======================================================
echo.
echo  Pour demarrer l'application :
echo    - Double-cliquez sur start.bat
echo    - Ou lancez-le depuis un terminal
echo.
echo  L'application sera accessible sur http://localhost:5173
echo.
pause
ENDLOCAL
exit /b 0

:: ─────────────────────────────────────────────────────────
:: Gestion des erreurs
:: ─────────────────────────────────────────────────────────
:error
echo.
echo  =======================================================
echo     ERREUR : L'installation a echoue.
echo     Verifiez les messages ci-dessus pour plus de details.
echo  =======================================================
echo.
echo  Appuyez sur une touche pour fermer cette fenetre...
pause >nul
ENDLOCAL
exit /b 1
