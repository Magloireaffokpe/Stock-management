# MICROLOGIS Stock Manager — Documentation Technique Complète

> Application de gestion de stock **100 % locale** pour **MICROLOGIS INFORMATIQUE & GSM**, Parakou, Bénin.  
> Stack : **Django 4.2 + React 18 + SQLite + Docker Compose** · Aucun cloud, aucun abonnement, zéro dépendance externe.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Prérequis système](#2-prérequis-système)
3. [Installation pas à pas](#3-installation-pas-à-pas)
4. [Lancement et arrêt](#4-lancement-et-arrêt)
5. [Structure du projet](#5-structure-du-projet)
6. [Backend — Architecture Django](#6-backend--architecture-django)
7. [Frontend — Architecture React](#7-frontend--architecture-react)
8. [API Reference complète](#8-api-reference-complète)
9. [Automatisation du stock — Signals](#9-automatisation-du-stock--signals)
10. [WebSocket — Temps réel](#10-websocket--temps-réel)
11. [Authentification et rôles](#11-authentification-et-rôles)
12. [Tests](#12-tests)
13. [Sauvegarde et restauration](#13-sauvegarde-et-restauration)
14. [Configuration avancée](#14-configuration-avancée)
15. [Dépannage](#15-dépannage)
16. [Glossaire des fichiers clés](#16-glossaire-des-fichiers-clés)

---

## 1. Vue d'ensemble

### Ce que fait l'application

| Module | Fonctionnalités |
|---|---|
| **Point de vente (POS)** | Grille produits cliquable, panier, prix négociables, 5 modes de paiement, calcul monnaie auto |
| **Gestion des ventes** | Historique paginé, annulation avec restauration stock automatique, export Excel, PDF facture |
| **Catalogue** | CRUD produits/catégories/fournisseurs, filtres multi-critères, soft delete, photos |
| **Stock** | Traçabilité complète de chaque mouvement, alertes automatiques (faible/critique/rupture), ajustement manuel |
| **Réapprovisionnements** | Création réappro multi-produits, mise à jour automatique stock + prix d'achat |
| **Clients** | Fiche client, historique achats, statistiques |
| **Rapports** | Dashboard KPIs, graphiques CA journalier/mensuel, top produits, valeur stock, exports Excel |
| **Paramètres** | Logo, couleurs, seuils alertes, gestion utilisateurs, sauvegarde/restauration BDD |

### Flux de données résumé

```
React (localhost:5173)
    │  /api/* → proxy Vite
    ▼
Django REST API (localhost:8000)
    │  Lecture / écriture
    ▼
SQLite  ←  backend/db.sqlite3  (fichier unique = toute la BDD)

Django ──► WebSocket  ws://localhost:8000/ws/stock/
                │  Broadcast temps réel
                ▼
          React alertStore.js  →  son + badge non-lu
```

---

## 2. Prérequis système

### Logiciels obligatoires

| Logiciel | Version minimale | Vérification | Téléchargement |
|---|---|---|---|
| **Docker Desktop** (Windows/macOS) ou **Docker Engine** (Linux) | 24+ | `docker --version` | https://www.docker.com/ |
| **Docker Compose** | v2 | `docker compose version` | Inclus avec Docker Desktop |
| **Git** | récente | `git --version` | https://git-scm.com/ |

### Logiciels optionnels

| Logiciel | Utilité |
|---|---|
| **WeasyPrint** | Génération PDF factures dans le conteneur backend. |
| **Visual Studio Code** | Meilleure ergonomie pour le développement local. |

### Ressources minimales

- RAM : 4 Go libres recommandés
- Disque : 2 Go disponibles
- Processeur : tout ordinateur récent
- Réseau : nécessaire uniquement pour télécharger les images Docker au premier démarrage

---

## 3. Installation pas à pas

### 3.1 Cloner le projet

```bash
git clone <url-du-depot>
cd "Stock management"
```

### 3.2 Démarrer avec Docker Compose

```bash
docker compose up --build -d
```

Le premier démarrage télécharge les images nécessaires puis construit les conteneurs backend, frontend et Redis.

### 3.3 Compte administrateur initial

Au premier lancement, l’application crée automatiquement un compte administrateur si aucun utilisateur n’existe encore :

- Nom d’utilisateur : `admin`
- Mot de passe : `micrologis2026`

Il est recommandé de le changer immédiatement après la première connexion.

### 3.4 Vérification post-installation

```bash
docker compose ps
```

Vous devriez voir les services backend, frontend et redis en état `Up`.

---

## 4. Lancement et arrêt

### 4.1 Démarrage

Sur Windows, vous pouvez double-cliquer sur `start.bat`.

Depuis un terminal, la commande équivalente est :

```bash
docker compose up -d
```

### 4.2 Arrêt

```bash
docker compose down
```

Ou sur Windows : `stop.bat`.

### 4.3 Relance après modification

```bash
docker compose up --build -d
```

### 4.4 URLs d'accès

| URL | Description |
|---|---|
| `http://localhost` | Interface principale (frontend via Nginx) |
| `http://localhost/api/` | API Django REST |
| `ws://localhost/ws/stock/` | WebSocket alertes temps réel |

### 4.5 Accès depuis un autre poste du réseau local

L’application est exposée via le port 80 de la machine hôte. Il suffit de pointer votre navigateur vers l’adresse IP de la machine serveur :

```text
http://<ip-de-la-machine>
```

---

## 5. Structure du projet

```
micrologis-stock/
├── backend/
│   ├── config/
│   │   ├── settings.py          ← Configuration centrale Django
│   │   ├── urls.py              ← Routeur principal
│   │   ├── asgi.py              ← HTTP + WebSocket (Django Channels)
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── settings_app/        ← Paramètres magasin (singleton id=1)
│   │   ├── auth_app/            ← Utilisateurs + JWT + journal activité
│   │   ├── catalog/             ← Produits, catégories, fournisseurs
│   │   ├── sales/               ← Ventes, devis, réappros, clients, SIGNALS
│   │   ├── stock/               ← Mouvements, alertes, WebSocket consumer
│   │   └── reports/             ← Dashboard KPIs, exports Excel + PDF
│   ├── tests/                   ← 189 tests (unitaires + intégration + E2E)
│   │   ├── base.py              ← Classe de base + assertions métier
│   │   ├── factories.py         ← Création objets de test (UUID unique)
│   │   ├── test_settings.py     ← 18 tests
│   │   ├── test_auth.py         ← 23 tests
│   │   ├── test_catalog.py      ← 32 tests
│   │   ├── test_stock.py        ← 28 tests
│   │   ├── test_sales.py        ← 47 tests
│   │   ├── test_reports.py      ← 34 tests
│   │   └── test_integration.py  ← 7 scénarios E2E
│   ├── templates/invoices/
│   │   └── facture.html         ← Template PDF (WeasyPrint)
│   ├── initial_data.json        ← Données initiales
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── manage.py
│   ├── db.sqlite3               ← BASE DE DONNÉES (unique fichier)
│   ├── media/                   ← Images uploadées
│   ├── factures/                ← PDFs générés
│   └── backup/                  ← Sauvegardes automatiques
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js        ← Axios + intercepteurs JWT auto-refresh
│   │   │   └── index.js         ← Toutes les fonctions API (authAPI, catalogAPI…)
│   │   ├── store/
│   │   │   ├── authStore.js     ← État auth (Zustand + localStorage)
│   │   │   ├── settingsStore.js ← Paramètres magasin (cache Zustand)
│   │   │   └── alertStore.js    ← Alertes + connexion WebSocket
│   │   ├── components/layout/
│   │   │   └── Layout.jsx       ← Sidebar + Topbar + dropdown alertes
│   │   ├── pages/               ← 11 pages React
│   │   ├── App.jsx              ← Routeur + guards RequireAuth / RequireAdmin
│   │   ├── index.css            ← Design system (CSS variables, bleu dominant)
│   │   └── main.jsx
│   ├── public/
│   │   ├── logo.jpg             ← Logo MICROLOGIS
│   │   └── favicon.svg
│   ├── vite.config.js           ← Proxy /api → :8000
│   └── package.json
│
├── docker-compose.yml          ← Orchestration des services Docker
├── start.bat
├── stop.bat
├── README.md                    ← Guide utilisateur rapide
└── docs/                        ← Documentation technique et utilisateur
```

---

## 6. Backend — Architecture Django

### 6.1 Dépendances Python (`requirements.txt`)

```
Django==4.2.13                       Framework web principal
djangorestframework==3.15.2          API REST
djangorestframework-simplejwt==5.3.1 Authentification JWT (access + refresh tokens)
django-cors-headers==4.3.1           CORS pour les appels React
django-filter==23.5                  Filtres API (?stock_status=low, ?category=1…)
channels==4.0.0                      WebSocket — alertes temps réel
channels-redis==4.2.0                Backend channel layers (InMemory ici)
daphne==4.1.0                        Serveur ASGI (HTTP + WebSocket)
Pillow==10.3.0                       Traitement images (logo, photos produits)
WeasyPrint==62.3                     Génération PDF factures (optionnel)
openpyxl==3.1.2                      Export Excel .xlsx
python-dateutil==2.9.0               Manipulation dates
```

### 6.2 Points clés de `config/settings.py`

```python
# BDD — fichier local unique, pas de serveur requis
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {'timeout': 30},  # évite les verrous concurrents
    }
}

# WebSocket — InMemory (pas besoin de Redis pour usage local)
CHANNEL_LAYERS = {
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}
}

# JWT — durées longues adaptées à un usage interne
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),   # une journée de travail
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,               # invalide l'ancien refresh
}

# CORS — autoriser React en développement
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

AUTH_USER_MODEL = 'auth_app.User'     # Modèle utilisateur étendu (rôle)
TIME_ZONE = 'Africa/Porto-Novo'        # Fuseau Bénin
```

### 6.3 Modèles de données — Résumé

#### `StoreSettings` — Singleton (toujours `id=1`)

```python
store = StoreSettings.get()        # Méthode à utiliser systématiquement
store.store_name                   # "MICROLOGIS INFORMATIQUE & GSM"
store.low_stock_threshold          # 5  — alerte jaune
store.critical_stock_threshold     # 2  — alerte rouge + son
store.invoice_counter              # Auto-incrémenté à chaque vente (thread-safe)
store.invoice_prefix               # "MICRO" → factures "MICRO-2026-0001"
```

#### `Product` — Propriétés calculées

```python
product.stock_status    # 'ok' | 'low' | 'critical' | 'out_of_stock'
product.margin          # selling_price - purchase_price
product.margin_percent  # (margin / purchase_price) * 100
# Seuil personnalisé prioritaire sur le seuil global
# is_active=False au lieu de suppression physique (soft delete)
```

#### `StockMovement` — Traçabilité exhaustive

```python
movement.movement_type   # 'sale'|'sale_cancel'|'restock'|'adjustment'|'loss'|'return'|'initial'
movement.quantity        # positif = entrée, négatif = sortie
movement.stock_before    # snapshot avant
movement.stock_after     # snapshot après
movement.reference       # numéro de facture associé
# Jamais créé manuellement — toujours via signal ou vue dédiée
```

### 6.4 Commandes Django utiles

```bash
cd backend

# Migrations
python manage.py makemigrations   # Après modification d'un modèle
python manage.py migrate          # Appliquer les migrations
python manage.py showmigrations   # Voir l'état

# Données
python manage.py loaddata initial_data.json        # Données initiales
python manage.py dumpdata --indent 2 > dump.json   # Export complet JSON

# Utilisateurs
python manage.py createsuperuser          # Créer un admin (interactif)
python manage.py changepassword admin     # Changer le mot de passe

# Diagnostic
python manage.py check                    # Vérifier la configuration
python manage.py shell                    # Console Python + Django

# Serveur
python manage.py runserver                # localhost:8000
python manage.py runserver 0.0.0.0:8000  # Accessible réseau local

# Tests
python -m pytest tests/ -v                         # Tous les tests
python -m pytest tests/test_sales.py -v            # Un module
python -m pytest tests/ --cov=apps --cov-report=html  # Avec couverture
python -m pytest tests/ -x                         # Stopper au 1er échec
```

---

## 7. Frontend — Architecture React

### 7.1 Dépendances npm (`package.json`)

```json
"react": "18.3.1"              Framework UI
"react-router-dom": "6.23.1"  Navigation entre pages
"axios": "1.7.2"               Requêtes HTTP (avec intercepteurs JWT auto)
"zustand": "4.5.2"             État global léger (auth, settings, alertes)
"recharts": "2.12.7"           Graphiques (bar, line, pie)
"lucide-react": "0.383.0"     Icônes SVG
"react-hot-toast": "2.4.1"    Notifications toast
"date-fns": "3.6.0"           Manipulation dates
"vite": "5.2.11"              Bundler + serveur de développement
```

### 7.2 Proxy Vite → Django

```javascript
// frontend/vite.config.js
proxy: {
  '/api':      { target: 'http://localhost:8000', changeOrigin: true },
  '/media':    { target: 'http://localhost:8000', changeOrigin: true },
  '/factures': { target: 'http://localhost:8000', changeOrigin: true },
}
// Le navigateur appelle /api/... → Vite redirige vers Django
// Pas de problème CORS en développement
```

### 7.3 Stores Zustand

```javascript
// authStore.js
const { user, login, logout, isAdmin } = useAuthStore()
await login('admin', 'password')  // → /api/auth/login/ + localStorage
isAdmin()                          // true si role='admin' ou is_superuser

// settingsStore.js (chargé une fois au démarrage)
const settings = useSettingsStore(s => s.settings)
settings.store_name                // "MICROLOGIS INFORMATIQUE & GSM"
settings.currency                  // "FCFA"
settings.low_stock_threshold       // 5

// alertStore.js
const { unreadCount, connectWS } = useAlertStore()
connectWS()  // ws://localhost:8000/ws/stock/ + reconnexion auto 5s + keep-alive 30s
```

### 7.4 Client Axios — Intercepteurs JWT

```javascript
// Fonctionnement automatique (transparent pour les composants)
// 1. Requête → injecte "Authorization: Bearer {access_token}"
// 2. Réponse 401 → tente POST /api/token/refresh/
// 3. Si refresh OK → nouveau access stocké, requête rejouée
// 4. Si refresh expiré → event 'auth:logout' → redirection /login
// 5. Requêtes simultanées pendant le refresh → mises en file, rejouées ensemble
```

### 7.5 Design System — Variables CSS

```css
/* src/index.css — palette MICROLOGIS */
--blue-600: #1A52A0;     /* Couleur dominante (boutons, actif sidebar) */
--blue-900: #0D1B33;     /* Fond sidebar */
--orange-500: #F06820;   /* Accent (bouton POS, barre "aujourd'hui") */
--success: #16A34A;      /* Stock OK, confirmations */
--danger: #DC2626;       /* Alertes critique, rupture */
--warning: #D97706;      /* Stock faible */
--font-display: 'Sora';          /* Titres, KPI values */
--font-mono: 'Space Mono';       /* Montants, SKU, factures */
--font-body: 'DM Sans';          /* Texte courant */
```

### 7.6 Commandes de développement

```bash
cd frontend

npm run dev      # Serveur développement (localhost:5173, hot-reload)
npm run build    # Build production → dist/
npm run preview  # Prévisualiser le build

# Vérifier le build
npm run build 2>&1 | grep "built in"
# → ✓ built in 8.35s
```

---

## 8. API Reference complète

**Base URL :** `http://localhost:8000/api/`  
**Auth :** `Authorization: Bearer {access_token}` sur toutes les routes sauf `/auth/login/`  
**Pagination :** `{ count, next, previous, results: [...] }` · Paramètres : `?page=N&page_size=50`

---

### 8.1 Authentification — `/auth/`

| Méthode | Endpoint | Corps (JSON) | Rôle requis |
|---|---|---|---|
| `POST` | `/auth/login/` | `{username, password}` | Public |
| `POST` | `/auth/logout/` | `{refresh}` | Connecté |
| `POST` | `/token/refresh/` | `{refresh}` | Public |
| `GET` | `/auth/me/` | — | Connecté |
| `PATCH` | `/auth/me/` | `{first_name, password, …}` | Connecté |
| `GET` | `/auth/users/` | — | Admin |
| `POST` | `/auth/users/` | `{username, password, role, …}` | Admin |
| `PATCH` | `/auth/users/{id}/` | `{is_active, role, …}` | Admin |
| `DELETE` | `/auth/users/{id}/` | — | Admin |
| `GET` | `/auth/activity/` | — | Admin |

**Payload JWT (décodé) :**
```json
{ "user_id": 1, "username": "admin", "role": "admin", "full_name": "…", "exp": 1748649600 }
```

---

### 8.2 Catalogue — `/catalog/`

#### Catégories

| Méthode | Endpoint | Filtres | Rôle |
|---|---|---|---|
| `GET` | `/catalog/categories/` | `?active_only=true` | Connecté |
| `POST` | `/catalog/categories/` | — | Admin |
| `PATCH` | `/catalog/categories/{id}/` | — | Admin |
| `DELETE` | `/catalog/categories/{id}/` | — | Admin |

#### Produits

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/catalog/products/` | Liste paginée |
| `POST` | `/catalog/products/` | Créer (`multipart/form-data` si image) |
| `GET` | `/catalog/products/{id}/` | Détail (avec `description` + `specifications`) |
| `PATCH` | `/catalog/products/{id}/` | Modifier |
| `DELETE` | `/catalog/products/{id}/` | Soft delete (`is_active=False`) |
| `GET` | `/catalog/products/low-stock/` | Produits sous le seuil |
| `GET` | `/catalog/products/search/?q=HP` | Recherche rapide POS (20 max) |

**Filtres produits :**
```
?category=1               Par catégorie (id)
?stock_status=low         ok | low | critical | out_of_stock
?condition=new            new | used | refurbished
?supplier=2               Par fournisseur (id)
?is_active=true           Actifs seulement
?search=samsung           Nom + SKU
?ordering=selling_price   Tri (- pour DESC)
```

---

### 8.3 Ventes — `/sales/`

#### Créer une vente (endpoint principal POS)

```http
POST /api/sales/sales/create/

{
  "client_id": 3,                        // null = client comptoir
  "items": [
    {"product_id": 2, "quantity": 1, "unit_price": 135000}
  ],
  "payment_method": "mtn",               // cash|mtn|moov|card|transfer|mixed
  "amount_paid": 140000,
  "discount": 5000                       // remise globale
}
```

**Réponse 201 — champs clés :**
```json
{
  "invoice_number": "MICRO-2026-0042",
  "total_amount": "130000",
  "change_given": "10000",
  "items": [{"product_name": "…", "unit_price": "135000", "purchase_price": "115000"}],
  "total_margin": "20000"
}
```

> ⚡ Stock décrémenté automatiquement via signal + `StockMovement` créé.

#### Autres endpoints ventes

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/sales/sales/` | Historique (filtres ci-dessous) |
| `GET` | `/sales/sales/{id}/` | Détail avec items et marges |
| `POST` | `/sales/sales/{id}/cancel/` | Annuler (stock restauré auto) |
| `GET` | `/sales/clients/` | Liste clients |
| `POST` | `/sales/clients/` | Créer client |
| `GET` | `/sales/restocks/` | Liste réappros |
| `POST` | `/sales/restocks/create/` | Créer réappro (stock++ auto) |

**Filtres historique ventes :**
```
?search=MICRO-2026-0042    N° facture
?payment_method=cash       Mode paiement
?is_cancelled=false        Validées uniquement
?date_from=2026-05-01
?date_to=2026-05-31
?ordering=-created_at      Plus récentes en premier
```

---

### 8.4 Stock — `/stock/`

| Méthode | Endpoint | Description | Rôle |
|---|---|---|---|
| `GET` | `/stock/movements/` | Tous les mouvements | Connecté |
| `GET` | `/stock/movements/product/{id}/` | Historique d'un produit | Connecté |
| `POST` | `/stock/adjust/` | Ajustement manuel | Admin |
| `GET` | `/stock/alerts/` | Alertes non résolues | Connecté |
| `GET` | `/stock/alerts/count/` | `{unread_count: 3}` | Connecté |
| `POST` | `/stock/alerts/read-all/` | Tout marquer lu | Connecté |
| `PATCH` | `/stock/alerts/{id}/read/` | Marquer une alerte lue | Connecté |
| `PATCH` | `/stock/alerts/{id}/resolve/` | Résoudre une alerte | Admin |

**Ajustement manuel :**
```json
POST /api/stock/adjust/
{
  "product_id": 3,
  "quantity": -2,           // négatif = sortie
  "movement_type": "loss",  // adjustment | loss | return
  "note": "Casse accidentelle"
}
```

---

### 8.5 Rapports — `/reports/`

| Endpoint | Description | Filtres |
|---|---|---|
| `GET /reports/dashboard/` | KPIs today/week/month/year + stock | — |
| `GET /reports/dashboard/recent-sales/` | 5 dernières ventes | — |
| `GET /reports/charts/daily/` | Données bar chart N jours | `?days=7` |
| `GET /reports/charts/monthly/` | Courbe CA 12 mois | — |
| `GET /reports/charts/categories/` | Répartition CA par catégorie | `?date_from&date_to` |
| `GET /reports/charts/payment-methods/` | Stats méthodes paiement | `?date_from&date_to` |
| `GET /reports/top-products/` | Top produits par CA | `?limit=10&date_from&date_to` |
| `GET /reports/stock-value/` | Valeur totale du stock | — |
| `GET /reports/invoice/{id}/pdf/` | PDF facture (génération à la demande) | — |
| `GET /reports/export/sales/` | Export Excel ventes | `?date_from&date_to` |
| `GET /reports/export/products/` | Export Excel catalogue | `?category` |
| `GET /reports/export/movements/` | Export Excel mouvements | `?date_from&date_to` |

**Structure réponse dashboard :**
```json
{
  "today":  {"revenue": 850000, "profit": 185000, "count": 7, "variation_revenue": 12.5},
  "week":   {"revenue": 3200000, "profit": 680000, "count": 28, "variation_revenue": -3.2},
  "month":  {"revenue": 12500000, "profit": 2800000, "count": 94, "variation_revenue": 18.7},
  "year":   {"revenue": 87000000, "profit": 19500000, "count": 712, "variation_revenue": 34.2},
  "stock":  {"total_products": 47, "out_of_stock": 2, "critical": 4, "low": 8, "unread_alerts": 6}
}
```

---

### 8.6 Paramètres — `/settings/`

| Méthode | Endpoint | Description | Rôle |
|---|---|---|---|
| `GET` | `/settings/` | Paramètres complets | Connecté |
| `PATCH` | `/settings/` | Modifier (multipart si logo) | Admin |
| `GET` | `/settings/backup/export/` | Télécharger `db.sqlite3` | Admin |
| `POST` | `/settings/backup/restore/` | Restaurer une BDD | Admin |
| `GET` | `/settings/backup/list/` | 10 dernières sauvegardes | Admin |
| `POST` | `/settings/backup/manual/` | Sauvegarde immédiate | Admin |

---

## 9. Automatisation du stock — Signals

Le stock est **toujours géré automatiquement**. Il ne faut jamais modifier `stock_quantity` directement.

### Flux complet

```
Vente créée → SaleItem.post_save → auto_decrement_stock_on_sale()
  ├─ product.stock_quantity -= quantity
  ├─ StockMovement(type='sale') créé
  ├─ check_and_create_alert(product)
  └─ notify_stock_update() → WebSocket broadcast

Vente annulée → SaleCancelView (transaction atomique)
  ├─ product.stock_quantity += quantity  (pour chaque item)
  ├─ StockMovement(type='sale_cancel') créé
  └─ notify_stock_update() → WebSocket broadcast

Réappro créé → RestockItem.post_save → auto_increment_stock_on_restock()
  ├─ product.stock_quantity += quantity
  ├─ product.purchase_price = unit_cost   (mise à jour prix achat)
  ├─ StockMovement(type='restock') créé
  └─ check_and_create_alert() → résout alertes si stock revenu OK

Ajustement manuel → StockAdjustmentView (sans signal)
  ├─ product.stock_quantity += quantity (±)
  ├─ StockMovement(type='adjustment'|'loss'|'return') créé
  └─ check_and_create_alert() + notify_stock_update()
```

### Logique des alertes (`stock/utils.py`)

```python
def check_and_create_alert(product):
    store     = StoreSettings.get()
    threshold = product.low_stock_threshold or store.low_stock_threshold
    critical  = store.critical_stock_threshold

    if   product.stock_quantity <= 0:        level = 'out'
    elif product.stock_quantity <= critical:  level = 'critical'
    elif product.stock_quantity <= threshold: level = 'low'
    else:
        # Stock OK → résoudre les alertes existantes
        StockAlert.objects.filter(product=product, is_resolved=False).update(is_resolved=True)
        return None, None

    # get_or_create → jamais de doublons d'alertes non résolues
    alert, _ = StockAlert.objects.get_or_create(
        product=product, alert_level=level, is_resolved=False,
        defaults={'stock_at_alert': product.stock_quantity}
    )
    return alert, level
```

---

## 10. WebSocket — Temps réel

### Backend (`stock/consumers.py`)

```python
# URL : ws://localhost:8000/ws/stock/
# Groupe : 'stock_alerts' (broadcast à tous les clients connectés)

class StockConsumer(AsyncWebsocketConsumer):
    async def connect(self):     # Rejoindre le groupe
    async def disconnect(self):  # Quitter le groupe
    async def receive(self):     # Répondre aux PING

    # Handlers des messages broadcastés depuis utils.py
    async def stock_update(self, event): ...  # STOCK_UPDATE → React
    async def stock_alert(self, event):  ...  # STOCK_ALERT  → React
```

### Messages émis

```json
{"type": "STOCK_UPDATE", "product_id": 3, "product_name": "…", "stock_quantity": 2, "stock_status": "critical"}
{"type": "STOCK_ALERT",  "product_id": 3, "product_name": "…", "alert_level": "critical", "stock_quantity": 2}
```

### Frontend (`alertStore.js`)

```javascript
connectWS() {
  const ws = new WebSocket('ws://localhost:8000/ws/stock/')
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'STOCK_ALERT')  { incrementUnread(); fetchAlerts(); playSound() }
    if (msg.type === 'STOCK_UPDATE') { window.dispatchEvent(new CustomEvent('stock:update', {detail: msg})) }
  }
  ws.onclose = () => setTimeout(() => connectWS(), 5000)  // Reconnexion auto
  setInterval(() => ws.send(JSON.stringify({type: 'PING'})), 30000)  // Keep-alive
}
```

---

## 11. Authentification et rôles

### Rôles disponibles

| Rôle | Accès |
|---|---|
| **admin** | Tout : Paramètres, Utilisateurs, Annulations, Réappros, Ajustements, Rapports |
| **employee** | Dashboard, POS (créer ventes), Historique (lecture), Clients, Catalogue (lecture) |

### Flux JWT

```
1. POST /api/auth/login/
   → {access (8h), refresh (30j), user: {id, username, role}}
   → Stockés dans localStorage

2. Chaque requête → "Authorization: Bearer {access}"
   → 401 → tentative /api/token/refresh/
   → Nouveau access → requête rejouée

3. POST /api/auth/logout/
   → Refresh blacklisté en BDD
   → localStorage vidé → /login
```

### Guards React (`App.jsx`)

```jsx
<RequireAuth>         // Redirige vers /login si non connecté
<RequireAdmin>        // Redirige vers / si pas admin
```

---

## 12. Tests

### Lancer les tests

```bash
cd backend

# Tous les tests (189)
python -m pytest tests/ -v

# Module spécifique
python -m pytest tests/test_sales.py -v

# Avec couverture de code
python -m pytest tests/ --cov=apps --cov-report=html
# Rapport : backend/coverage_report/index.html

# Test unique
python -m pytest "tests/test_sales.py::SaleCancelSignalTest::test_annulation_restaure_stock" -v

# Stop au 1er échec
python -m pytest tests/ -x
```

### Résultats — 189 tests, 100 % passants

| Fichier | Tests | Ce qui est testé |
|---|---|---|
| `test_settings.py` | 18 | Singleton StoreSettings, API GET/PATCH, sauvegarde/export |
| `test_auth.py` | 23 | Login JWT, payload token, logout+blacklist, CRUD utilisateurs |
| `test_catalog.py` | 32 | Modèles (slug, SKU, marge, stock_status), CRUD API, filtres |
| `test_stock.py` | 28 | `check_and_create_alert()`, anti-duplication, API ajustement |
| `test_sales.py` | 47 | Signals vente/annulation/réappro, snapshot prix, calculs remise |
| `test_reports.py` | 34 | Dashboard KPIs, graphiques, exports Excel |
| `test_integration.py` | 7 | Scénarios E2E : journée complète, rupture→réappro, inventaire |
| **Total** | **189** | |

### Architecture de test

```python
# Classe de base (base.py)
class BaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):        # Données créées une seule fois par classe
        cls.store    = make_settings()
        cls.admin    = make_admin()
        cls.employee = make_employee()

    def setUp(self):               # Clients HTTP frais avant chaque test
        self.admin_client    = APIClient()  # JWT admin injecté
        self.employee_client = APIClient()  # JWT employé injecté

    # Assertions métier
    def assertStockEquals(product, qty)
    def assertMovementExists(product, type, qty)
    def assertAlertExists(product, level)
    def assertNoAlert(product)
```

---

## 13. Sauvegarde et restauration

```
backend/db.sqlite3  ←  TOUT est ici (ventes, stock, clients, paramètres, users)
```

### Via l'interface (Paramètres → Sauvegarde)

```
Télécharger la BDD      →  GET  /api/settings/backup/export/
Sauvegarde immédiate    →  POST /api/settings/backup/manual/
Liste des sauvegardes   →  GET  /api/settings/backup/list/
Restaurer               →  POST /api/settings/backup/restore/  (champ "database")
```

### Via ligne de commande

```bash
# Sauvegarde rapide
cp backend/db.sqlite3 backup_$(date +%Y%m%d_%H%M%S).sqlite3

# Export JSON lisible
cd backend
python manage.py dumpdata settings_app auth_app catalog sales stock \
  --indent 2 > backup_$(date +%Y%m%d).json

# Restauration SQLite
cp backup_20260530.sqlite3 backend/db.sqlite3
# Relancer le serveur

# Restauration JSON
cd backend
python manage.py migrate
python manage.py loaddata backup_20260530.json
```

### Automatisation (cron Linux)

```bash
# crontab -e — sauvegarde quotidienne à 23h, conservation 30 jours
0 23 * * * cp /opt/micrologis/backend/db.sqlite3 /opt/backups/db_$(date +\%Y\%m\%d).sqlite3
0 23 * * * find /opt/backups/ -name "db_*.sqlite3" -mtime +30 -delete
```

### Automatisation Windows — Planificateur de tâches

```
Programme : cmd.exe
Arguments : /c copy C:\micrologis\backend\db.sqlite3 C:\backups\db_%date:~10,4%%date:~4,2%%date:~7,2%.sqlite3
Déclencheur : Quotidien à 23h00
```

---

## 14. Configuration avancée

### Changer le port

```python
# backend/config/settings.py
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '192.168.1.100', '*']

# Lancement
python manage.py runserver 0.0.0.0:9000
```

```javascript
// frontend/vite.config.js
proxy: { '/api': { target: 'http://localhost:9000' } }
```

### Activer Redis pour WebSocket (multi-workers)

```python
# settings.py
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [('127.0.0.1', 6379)]},
    }
}
# pip install channels-redis + lancer Redis
```

### Variables d'environnement (production)

```bash
# backend/.env
SECRET_KEY=votre-cle-secrete-longue-et-aleatoire
DEBUG=False
ALLOWED_HOSTS=192.168.1.100,localhost
```

```python
# settings.py
from decouple import config   # pip install python-decouple
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
```

### Mise à jour de l'application

```bash
# 1. Sauvegarder la BDD avant toute mise à jour
cp backend/db.sqlite3 backup_avant_maj.sqlite3

# 2. Remplacer les fichiers sources (sauf db.sqlite3, media/, backup/)
# 3. Appliquer les nouvelles migrations
cd backend && python manage.py migrate

# 4. Reconstruire le frontend
cd ../frontend && npm install && npm run build

# 5. Relancer
bash start.sh
```

---

## 15. Dépannage

### Port déjà utilisé

```bash
# Linux/Mac
lsof -ti:8000 | xargs kill
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### `python: command not found`

```bash
python3 manage.py runserver   # Essayer python3
# Sous Windows : réinstaller Python en cochant "Add Python to PATH"
```

### Migration manquante / table absente

```bash
cd backend
python manage.py showmigrations        # Voir l'état
python manage.py migrate --run-syncdb  # Forcer la synchronisation
```

### Frontend ne se connecte pas à l'API

```bash
# 1. Django est-il lancé ?
curl http://localhost:8000/api/settings/
# Pas de réponse → démarrer Django

# 2. Config proxy correcte ?
cat frontend/vite.config.js | grep target
# Doit afficher : 'http://localhost:8000'

# 3. CORS correct ?
grep CORS backend/config/settings.py
# Doit inclure http://localhost:5173
```

### Erreur 403 Forbidden

```bash
# Vérifier le rôle en BDD
cd backend
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
for u in User.objects.all():
    print(u.username, '|', u.role, '| staff:', u.is_staff, '| super:', u.is_superuser)
"
# Les admins doivent avoir is_staff=True
```

### PDF facture ne fonctionne pas

```bash
# Vérifier WeasyPrint
python -c "import weasyprint; print('OK')"

# Linux — installer les dépendances système
sudo apt-get install python3-cffi libpango-1.0-0 libpangoft2-1.0-0

# Windows — installer GTK3 Runtime
# https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
```

### Réinitialisation complète

```bash
cd backend
rm -f db.sqlite3
python manage.py migrate
python manage.py loaddata initial_data.json
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
User.objects.create_superuser('admin', 'admin@micrologis.bj', 'micrologis2026', role='admin')
print('Admin recréé : admin / micrologis2026')
"
```

---

## 16. Glossaire des fichiers clés

| Fichier | Rôle | À modifier si… |
|---|---|---|
| `backend/config/settings.py` | Configuration Django centrale | Changement port, CORS, JWT, debug |
| `backend/config/urls.py` | Routeur URL principal | Ajout d'une nouvelle app |
| `backend/apps/sales/signals.py` | Cœur de l'automatisation stock | **Éviter** — risque de désynchronisation |
| `backend/apps/stock/utils.py` | Logique alertes + WebSocket | **Éviter** |
| `backend/apps/settings_app/models.py` | Paramètres magasin (singleton) | Ajout d'un nouveau champ de config |
| `backend/initial_data.json` | Données initiales | Personnaliser les catégories par défaut |
| `backend/templates/invoices/facture.html` | Template HTML factures | Changer la mise en page PDF |
| `backend/requirements.txt` | Dépendances Python | Ajout d'une bibliothèque |
| `frontend/src/api/index.js` | Toutes les fonctions API React | Ajout d'un nouvel endpoint |
| `frontend/src/api/client.js` | Axios + intercepteurs JWT | Changement logique authentification |
| `frontend/src/index.css` | Design system complet | Changement thème/couleurs global |
| `frontend/src/store/alertStore.js` | WebSocket + alertes temps réel | Changement comportement alertes |
| `frontend/vite.config.js` | Proxy API + port dev | Changement port backend |
| `frontend/public/logo.jpg` | Logo MICROLOGIS | Mise à jour du logo |
| `backend/db.sqlite3` | **Base de données complète** | Jamais manuellement — via migrations |

---

## Résumé des identifiants par défaut

```
Interface web  :  http://localhost:5173
API backend    :  http://localhost:8000/api/
Admin Django   :  http://localhost:8000/admin/

Compte admin   :  admin
Mot de passe   :  micrologis2026

⚠️  Changer le mot de passe en production :
    Paramètres → Utilisateurs → admin → Modifier le mot de passe
```

---

*Documentation technique — MICROLOGIS INFORMATIQUE & GSM, Parakou, Bénin — Version 1.0, Mai 2026*
