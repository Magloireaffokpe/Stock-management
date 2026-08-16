# MICROLOGIS Stock Manager

Application de gestion de stock multi-boutiques pour **MICROLOGIS INFORMATIQUE & GSM**, Parakou, Bénin.

- Frontend : React + Vite (servi par Nginx)
- Backend : Django + Django REST Framework + Channels (Daphne)
- Base de données : SQLite (fichier local, aucune dépendance cloud)
- Conteneurisation : Docker Compose

---

## 1. Déploiement sur la machine du client (mode Docker)

### 1.1 Prérequis sur la machine cible

| Logiciel | Version | Vérification |
|---|---|---|
| Docker Desktop (Windows) ou Docker Engine (Linux) | 24+ | `docker --version` |
| Docker Compose | v2 | `docker compose version` |
| Git | récente | `git --version` |

Ressources : 4 Go de RAM libres, 2 Go de disque, accès Internet **au premier lancement** (téléchargement des images).

### 1.2 Récupérer le projet

```bash
git clone <url-du-depot>
cd "Stock management"
```

> La base de données **ne fait pas partie du dépôt** (voir §4) : la machine du client démarre donc **automatiquement avec une base neuve**.

### 1.3 Lancer l'application (premier lancement)

```bash
docker compose up --build -d
```

Sous Windows : double-cliquez sur `start.bat` (racine) — il crée le dossier `backend\data` puis démarre les conteneurs.

Le premier lancement construit les images **backend** et **frontend**. Cela peut prendre plusieurs minutes.

> 🌐 **Fonctionnement hors-ligne :** une fois les images construites (ou chargées via `docker load`), l'application tourne **sans aucune connexion Internet** — tout est local (base SQLite, PDF, WebSocket en mémoire). Internet n'est nécessaire qu'à la **première** construction des images.

### 1.4 Vérifier que tout fonctionne

```bash
docker compose ps        # les 2 services doivent être "Up"
```

| URL | Description |
|---|---|
| `http://localhost` | Application (interface) |
| `http://localhost/admin/` | Administration Django |
| `http://localhost/api/` | API REST |
| `http://localhost:8000` | Backend direct (optionnel) |

---

## 2. Compte administrateur et accès Django Admin

### 2.1 Compte initial

Au premier démarrage, le backend crée automatiquement un administrateur :

- **Nom d'utilisateur :** `admin`
- **Mot de passe :** `micrologis2026`

> **Changez immédiatement ce mot de passe** après la première connexion (Paramètres → Mon profil).

### 2.2 Personnaliser les identifiants (recommandé)

Les identifiants du compte auto-créé sont configurables par variables d'environnement dans `docker-compose.yml` :

```yaml
environment:
  - ADMIN_USERNAME=admin
  - ADMIN_EMAIL=admin@micrologis.local
  - ADMIN_PASSWORD=micrologis2026
```

Le compte n'est créé que s'il n'existe pas : le mot de passe ne sera **pas** réinitialisé à chaque redémarrage.

### 2.3 Administration Django

`http://localhost/admin/` donne accès à l'interface d'administration Django (utilisateurs, produits, ventes, stock, paramètres…). Seuls les comptes `is_staff` ou `is_superuser` y accèdent — par défaut, seul `admin`.

---

## 3. Gestion des images et des conteneurs

### Démarrer / arrêter

```bash
docker compose up -d      # démarrer (déjà construit)
docker compose down       # arrêter (les données sont conservées)
docker compose ps         # état des services
docker compose logs -f    # journaux en direct
docker compose logs backend -f    # journaux du seul backend
```

### Reconstruire après une mise à jour de code

```bash
docker compose build      # reconstruit les images (code)
docker compose up -d      # applique la nouvelle version
```

Raccourci Windows : `update.bat` (racine).

### Nettoyer les images inutilisées

```bash
docker image prune -a     # supprime les images inutilisées (rebuild ou reload au prochain lancement)
docker system df          # espace disque utilisé par Docker
```

### Sauvegarder / exporter les images (déploiement sans Internet)

Les images **contiennent tout le code nécessaire** (backend Python + dépendances, frontend compilé + Nginx) : le client n'a **pas besoin du code source**, ni de Node/Python, ni d'Internet.

Sur la machine avec Internet (une fois les images construites) :

```bash
docker save micrologis/backend:latest micrologis/frontend:latest -o micrologis-images.tar
```

Puis sur la machine cible, copier le fichier `.tar` (**~400 Mo**) et le fichier `docker-compose.yml` :

```bash
mkdir micrologis && cd micrologis
# coller docker-compose.yml ici
docker load -i micrologis-images.tar
docker compose up -d
```

La machine cible n'a alors **jamais besoin d'Internet**. Docker crée automatiquement les dossiers de données (`backend/data`, `backend/media`, …) au premier démarrage.

> **Quand le code n'est pas copié, seul le `docker-compose.yml` est nécessaire** (il définit les volumes, le port 80 et les variables). Les images déjà chargées sont utilisées telles quelles — aucun rebuild ne se produit.

---

## 4. Base de données neuve — comment ça marche

- `*.sqlite3`, `backend/data/`, `backend/media/`, `backend/factures/`, `backend/backup/` sont **ignorés par Git** (voir `.gitignore`).
- À chaque clone sur une nouvelle machine, **il n'y a aucune base** : au premier `docker compose up`, le backend :
  1. applique les migrations → crée toutes les tables (vierges) ;
  2. crée le compte `admin` ;
  3. démarre Daphne.

La base vit dans `backend/data/db.sqlite3` (dossier monté dans le conteneur, persistant). Pour repartir d'une base neuve : `docker compose down`, supprimez `backend/data/db.sqlite3`, puis `docker compose up -d`.

> 💾 **Transferer des données existantes au client (pas une image !)** : la base de données **ne doit jamais être intégrée dans une image Docker** (elle serait écrasée à chaque mise à jour d'image). Pour démarrer le client avec vos données, transférez un **fichier de sauvegarde** `.sqlite3` (export depuis Paramètres → Sauvegardes, ou `backend/backup/manual_*.sqlite3`) :
> - soit déposez-le dans `backend/data/db.sqlite3` **avant** le premier `docker compose up` ;
> - soit lancez l'app puis Paramètres → Sauvegardes → **Restaurer**.

> ⚠️ **Migration de premier déploiement :** la migration `catalog/0004` vide les anciennes données de catalogue (produits/catégories). Sur une base neuve c'est sans effet (tables déjà vides). Ne déployez **pas** ce dépôt par-dessus une ancienne base remplie sans sauvegarde préalable.

---

## 5. Données et sauvegardes

| Donnée | Emplacement (hôte) |
|---|---|
| Base de données | `backend/data/db.sqlite3` |
| Images / logo / médias | `backend/media/` |
| Factures PDF générées | `backend/factures/` |
| Sauvegardes automatiques | `backend/backup/` |

L'application fait une **sauvegarde automatique quotidienne** et propose aussi :
- Sauvegarde manuelle (Paramètres → Sauvegardes)
- Téléchargement / restauration de la base depuis l'interface
- Restauration : remplace `db.sqlite3` (une copie de l'ancienne est conservée dans `backup/`)

Ces 4 dossiers sont volontairement laissés **hors Git** : ils sont propres à chaque machine.

---

## 6. Rôles et permissions

| Rôle | Boutiques/Catégories/Produits | Stock & Réappros | Ventes (POS) | Paramètres & Utilisateurs |
|---|---|---|---|---|
| **Admin** | Lecture + écriture | Lecture + écriture | Lecture + écriture | Oui |
| **Employé** | **Lecture seule** | Lecture seule | Création de ventes (prix libre) | Non |

Un compte est considéré **admin** si **une** de ces conditions est vraie : `role == 'admin'` **ou** `is_staff` **ou** `is_superuser`. (Frontend et backend appliquent exactement la même règle.)

La gestion multi-boutiques se fait dans la page **Boutiques** (admin uniquement) ; la profondeur des catégories est limitée à 4 niveaux.

---

## 7. Dépannage

| Problème | Solution |
|---|---|
| Conteneurs non démarrés | `docker compose ps` puis `docker compose up -d` |
| Port 80 occupé | Changer `"80:80"` dans `docker-compose.yml` (ex. `"8080:80"`) puis relancer |
| Image obsolète | `docker compose build && docker compose up -d` |
| Mot de passe admin oublié | `docker compose exec backend python manage.py changepassword admin` |
| Erreur "database is locked" | Arrêter tout (`docker compose down`), relancer |
| Pas d'Internet au 1er lancement | Pré-charger les images (§3 « exporter les images ») |

---

## 8. Mode local sans Docker (développement, Windows)

1. Double-cliquez sur `scripts/windows/local/install.bat` (dépendances + migrations + compte admin).
2. Double-cliquez sur `scripts/windows/local/start.bat` (backend Daphne + frontend Vite, navigateur ouvert sur `http://localhost:5173`).
3. `scripts/windows/local/stop.bat` pour arrêter.

Prérequis : Python 3.12 (`py -3`) et Node.js LTS.

---

## 9. Développement

```bash
# Backend (tests)
cd backend
venv/bin/python -m pytest                # suite complète

# Frontend (build de production)
cd frontend
npm run build
```

Détails techniques : voir [docs/MICROLOGIS_DOCUMENTATION.md](docs/MICROLOGIS_DOCUMENTATION.md) et [docs/GUIDE_UTILISATEUR.md](docs/GUIDE_UTILISATEUR.md).
