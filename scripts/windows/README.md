# Scripts de démarrage / arrêt

## Docker (recommandé pour le client)

À la racine du projet, des raccourcis « double-clic » pour Windows :

- `start.bat` : démarre l'application, attend qu'elle réponde et ouvre le navigateur sur `http://localhost`. La connexion se fait avec le compte administrateur communiqué par l'installateur (aucun identifiant affiché).
- `stop.bat` : arrête les conteneurs (les données sont conservées dans `backend\data`).

Les versions « profondes » équivalentes sont dans `scripts\windows\docker\` (appelées par les raccourcis).

**Linux / macOS :** mêmes fonctionnalités avec `./start.sh` et `./stop.sh` (racine, ou `scripts/linux/`).

### Compte administrateur

Au premier démarrage, le compte administrateur est créé automatiquement (défauts configurables dans `docker-compose.yml`, variables `ADMIN_*`). Les identifiants exacts sont à communiquer au client — ils ne sont pas affichés par les scripts. Le mot de passe n'est jamais réinitialisé lors des redémarrages suivants.

## Installation locale (sans Docker)

1. Exécuter `local\install.bat` une seule fois. Il installe les dépendances, applique les migrations et crée le compte `admin` si nécessaire.
2. Exécuter `local\start.bat`. Deux fenêtres s'ouvrent : backend ASGI/WebSocket et frontend Vite, puis le navigateur s'ouvre automatiquement.
3. Exécuter `local\stop.bat` pour fermer les deux processus et leurs terminaux.

Prérequis locaux : Python 3.12 (commande `py -3`) et Node.js LTS. Pour générer des PDF sous Windows, WeasyPrint peut nécessiter les bibliothèques système décrites dans sa documentation officielle.
