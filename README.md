# MICROLOGIS Stock Manager

Application de gestion de stock locale pour MICROLOGIS INFORMATIQUE & GSM, Parakou, Bénin.

## Prérequis

Avant de démarrer, assurez-vous d’avoir installé :

- Git
- Docker Desktop ou Docker Engine avec Docker Compose
- Un navigateur web moderne

> Si vous êtes sur Windows, vous pouvez aussi utiliser les scripts fournis : start.bat et stop.bat.

---

## 1. Cloner et démarrer le projet

Depuis votre terminal, placez-vous dans le dossier de travail puis exécutez :

```bash
git clone <url-du-depot>
cd "Stock management"
docker compose up --build -d
```

Si vous êtes sous Windows, vous pouvez simplement double-cliquer sur start.bat pour lancer l’application.

---

## 2. Accéder à l’application

Une fois les conteneurs démarrés :

- Interface utilisateur : http://localhost
- API Django : http://localhost/api/
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

Ou sur Windows : double-cliquez sur stop.bat.

### Relancer

```bash
docker compose up -d
```

### Rebuilder après un changement de code

```bash
docker compose up --build -d
```

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
Relancez les conteneurs avec :

```bash
docker compose up --build -d
```

---

## 7. Structure technique rapide

- Frontend : React + Vite
- Backend : Django + Django REST Framework
- Base de données : SQLite
- Temps réel : Django Channels + WebSockets
- Conteneurisation : Docker Compose

