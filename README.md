# MICROLOGIS Stock Manager — Guide utilisateur

Application de gestion de stock 100% locale pour **MICROLOGIS INFORMATIQUE & GSM**, Parakou, Bénin.

---

## 🚀 Démarrage rapide

### Installation (une seule fois)
```
Double-clic sur install.bat
```
Identifiants créés : **admin / micrologis2026**

### Lancement quotidien
```
Double-clic sur start.bat
→ L'application s'ouvre sur http://localhost:5173
```

---

## 📋 Endpoints API — Récapitulatif complet

### Authentification
| Méthode | URL | Description |
|---------|-----|-------------|
| POST | `/api/auth/login/` | Connexion → retourne access + refresh tokens |
| POST | `/api/auth/logout/` | Déconnexion (blacklist token) |
| GET/PATCH | `/api/auth/me/` | Profil utilisateur connecté |
| GET/POST | `/api/auth/users/` | Liste / créer utilisateurs (admin) |
| GET/PATCH/DELETE | `/api/auth/users/<id>/` | Détail utilisateur |
| GET | `/api/auth/activity/` | Journal d'activité |
| POST | `/api/token/refresh/` | Rafraîchir le token JWT |

### Catalogue
| Méthode | URL | Description |
|---------|-----|-------------|
| GET/POST | `/api/catalog/categories/` | Catégories |
| GET/PATCH/DELETE | `/api/catalog/categories/<id>/` | Détail catégorie |
| GET/POST | `/api/catalog/subcategories/` | Sous-catégories |
| GET/POST | `/api/catalog/suppliers/` | Fournisseurs |
| GET/PATCH/DELETE | `/api/catalog/suppliers/<id>/` | Détail fournisseur |
| GET/POST | `/api/catalog/products/` | Produits (filtres : category, stock_status, condition…) |
| GET/PATCH/DELETE | `/api/catalog/products/<id>/` | Détail produit |
| GET | `/api/catalog/products/low-stock/` | Produits en stock faible/critique/rupture |
| GET | `/api/catalog/products/search/?q=` | Recherche rapide (POS) |

### Ventes
| Méthode | URL | Description |
|---------|-----|-------------|
| GET/POST | `/api/sales/clients/` | Clients |
| GET/PATCH | `/api/sales/clients/<id>/` | Détail client |
| GET | `/api/sales/sales/` | Historique ventes (filtres : date_from, date_to…) |
| POST | `/api/sales/sales/create/` | **Créer une vente** (signal → stock auto) |
| GET | `/api/sales/sales/<id>/` | Détail vente avec items |
| POST | `/api/sales/sales/<id>/cancel/` | **Annuler une vente** (signal → stock restauré) |
| GET/POST | `/api/sales/quotations/` | Devis |
| POST | `/api/sales/quotations/<id>/convert/` | Convertir devis en vente |
| GET | `/api/sales/restocks/` | Historique réapprovisionnements |
| POST | `/api/sales/restocks/create/` | **Créer un réappro** (signal → stock auto) |
| GET | `/api/sales/restocks/<id>/` | Détail réappro |

### Stock
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/stock/movements/` | Tous les mouvements (filtres : product, type, date) |
| GET | `/api/stock/movements/product/<id>/` | Mouvements d'un produit |
| POST | `/api/stock/adjust/` | **Ajustement manuel** (perte, casse, correction) |
| GET | `/api/stock/alerts/` | Alertes stock non résolues |
| GET | `/api/stock/alerts/count/` | Nombre d'alertes non lues (badge) |
| POST | `/api/stock/alerts/read-all/` | Marquer tout comme lu |
| PATCH | `/api/stock/alerts/<id>/read/` | Marquer une alerte comme lue |
| PATCH | `/api/stock/alerts/<id>/resolve/` | Résoudre une alerte |

### Rapports & Exports
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/reports/dashboard/` | KPIs : CA jour/semaine/mois/année + variations |
| GET | `/api/reports/dashboard/recent-sales/` | 5 dernières ventes |
| GET | `/api/reports/charts/daily/?days=7` | Graphique barres ventes journalières |
| GET | `/api/reports/charts/monthly/` | Courbe CA mensuel 12 mois |
| GET | `/api/reports/charts/categories/` | Répartition par catégorie (pie chart) |
| GET | `/api/reports/charts/payment-methods/` | Stats méthodes de paiement |
| GET | `/api/reports/top-products/` | Top produits vendus |
| GET | `/api/reports/stock-value/` | Valeur totale du stock |
| GET | `/api/reports/invoice/<id>/pdf/` | Générer/télécharger facture PDF |
| GET | `/api/reports/export/sales/` | Export Excel historique ventes |
| GET | `/api/reports/export/products/` | Export Excel catalogue produits |
| GET | `/api/reports/export/movements/` | Export Excel mouvements stock |

### Paramètres
| Méthode | URL | Description |
|---------|-----|-------------|
| GET/PATCH | `/api/settings/` | Paramètres magasin (logo, couleurs, seuils…) |
| GET | `/api/settings/backup/export/` | Télécharger db.sqlite3 |
| POST | `/api/settings/backup/restore/` | Restaurer une sauvegarde |
| GET | `/api/settings/backup/list/` | 10 dernières sauvegardes |
| POST | `/api/settings/backup/manual/` | Déclencher une sauvegarde |

### WebSocket
| URL | Description |
|-----|-------------|
| `ws://localhost:8000/ws/stock/` | Alertes et mises à jour stock temps réel |

---

## ⚡ Automatisation du stock

Le stock est **toujours mis à jour automatiquement** via les Django signals. Jamais manuellement.

| Action | Signal déclenché | Effet |
|--------|-----------------|-------|
| Vente créée | `SaleItem.post_save` | Stock décrémenté + mouvement tracé |
| Vente annulée | `Sale.post_save` | Stock restauré + mouvement tracé |
| Réappro créé | `RestockItem.post_save` | Stock incrémenté + prix achat mis à jour |
| Ajustement | Vue directe | Stock corrigé + mouvement tracé |

Chaque mouvement génère une entrée dans `StockMovement` avec : stock avant, stock après, référence, utilisateur.

---

## 🔐 Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| **admin** | Tout — y compris Paramètres, Utilisateurs, Rapports avancés |
| **employee** | Dashboard, Ventes (création), Historique, Clients uniquement |

---

## 💾 Sauvegarde

La BDD entière = le fichier `backend/db.sqlite3`.

- **Sauvegarde manuelle** : `POST /api/settings/backup/manual/` ou bouton dans l'interface
- **Export** : `GET /api/settings/backup/export/` → télécharge le fichier
- **Restauration** : `POST /api/settings/backup/restore/` avec le fichier sqlite3
- Les sauvegardes auto sont dans `backend/backup/`
