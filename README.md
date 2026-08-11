# MICROLOGIS Stock Manager

Application de gestion de stock locale pour MICROLOGIS INFORMATIQUE & GSM, Parakou, Bénin.

## Prérequis

Avant de démarrer, assurez-vous d’avoir installé :

- Git
- Docker Desktop avec Docker Compose **ou**, pour le mode local, Python 3.12 et Node.js LTS
- Un navigateur web moderne

> Sous Windows, les scripts sont séparés par mode dans [scripts/windows](scripts/windows/README.md).

---

## 1. Choisir un mode de démarrage

### Mode Docker

Depuis votre terminal, placez-vous dans le dossier de travail puis exécutez :

```bash
git clone <url-du-depot>
cd "Stock management"
docker compose up -d
```

Sous Windows, double-cliquez sur `scripts/windows/docker/start.bat` (les fichiers `start.bat` et `stop.bat` à la racine restent des raccourcis Docker).

### Mode local, sans Docker (Windows)

1. Double-cliquez sur `scripts/windows/local/install.bat` : installation des dépendances, migrations et compte administrateur.
2. Double-cliquez sur `scripts/windows/local/start.bat` : les deux terminaux nécessaires et le navigateur s’ouvrent automatiquement.
3. Pour arrêter l’application, double-cliquez sur `scripts/windows/local/stop.bat`.

Le mode local démarre Daphne pour que l’API et le WebSocket fonctionnent correctement.

---

## 2. Accéder à l’application

Une fois les conteneurs démarrés :

- Interface utilisateur : http://localhost
- API Django : http://localhost/api/
- Administration Django : http://localhost/admin/
- WebSocket stock : ws://localhost/ws/stock/

Le frontend est servi via Nginx, et les appels API sont automatiquement redirigés vers le backend Django.

---

## 3. Première configuration

Au premier lancement, l’application crée automatiquement un compte administrateur si aucun utilisateur n’existe encore :

- Nom d’utilisateur : admin
- Mot de passe : micrologis2026

Il est fortement recommandé de changer ce mot de passe immédiatement depuis l’interface de paramètres.

### Configuration recommandée après la première connexion

- Modifier le mot de passe administrateur
- Définir les informations du magasin dans Paramètres
- Charger le logo de l’entreprise
- Ajuster les seuils d’alerte de stock
- Créer les utilisateurs employés si nécessaire

---

## 4. Arrêter et relancer l’application

### Arrêter

```bash
docker compose down
```

Ou sur Windows : double-cliquez sur `scripts/windows/docker/stop.bat`.

### Relancer

```bash
docker compose up -d
```

### Rebuilder après un changement de code

```bash
docker compose build
docker compose up -d
```

Ou sur Windows : double-cliquez sur `update.bat` à la racine (ou `scripts/windows/docker/update.bat`).

---

## 5. Données et sauvegardes

Les données principales sont stockées dans :

- Base de données : backend/db.sqlite3
- Médias : backend/media/
- Factures générées : backend/factures/
- Sauvegardes : backend/backup/

Vous pouvez aussi créer ou restaurer des sauvegardes depuis la section Paramètres de l’application.

---

## 6. Résolution des problèmes courants

### Docker n’est pas démarré
Vérifiez que Docker Desktop est lancé avant d’exécuter les commandes.

### L’application ne répond pas
Vérifiez l’état des conteneurs :

```bash
docker compose ps
```

### Les changements ne s’appliquent pas
Reconstruisez les conteneurs avec :

```bash
docker compose build
docker compose up -d
```
Ou sur Windows : utilisez le fichier `update.bat`.

---

## 7. Structure technique rapide

- Frontend : React + Vite
- Backend : Django + Django REST Framework
- Base de données : SQLite
- Temps réel : Django Channels + WebSockets
- Conteneurisation : Docker Compose
