# Scripts Windows

## Docker

- `docker\start.bat` : construit et démarre l'application sur `http://localhost`.
- `docker\stop.bat` : arrête les conteneurs.

## Installation locale (sans Docker)

1. Exécuter `local\install.bat` une seule fois. Il installe les dépendances, applique les migrations et crée le compte `admin` si nécessaire.
2. Exécuter `local\start.bat`. Deux fenêtres s'ouvrent : backend ASGI/WebSocket et frontend Vite, puis le navigateur s’ouvre automatiquement.
3. Exécuter `local\stop.bat` pour fermer les deux processus et leurs terminaux.

Prérequis locaux : Python 3.12 (commande `py -3`) et Node.js LTS. Pour générer des PDF sous Windows, WeasyPrint peut nécessiter les bibliothèques système décrites dans sa documentation officielle.
