# Spécification technique — Évolution Multi-Boutique

**Contexte** : Application Django 4.2 + React 18 (MICROLOGIS Stock Manager). Base SQLite unique partagée entre deux boutiques physiques côte à côte. Refonte du catalogue, suppression du suivi de coût/marge, et prix de vente saisi à la vente.

**Instruction pour l'IA d'implémentation** : ce document contient déjà toutes les décisions d'architecture validées. Ne pas re-discuter les choix ci-dessous, les implémenter tels quels. Poser une question uniquement si un point technique n'est pas couvert.

---

## 1. Modèles Django

### 1.1 `stores/models.py` (nouvelle app)

```python
class Store(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
```

- Pas de suppression possible : retirer l'action `destroy` du `StoreViewSet` (bloquer aussi côté API, pas seulement cacher le bouton côté frontend).
- Seul `is_active` (toggle) permet de "fermer" une boutique sans perdre son historique.

### 1.2 `catalog/models.py` — Category (remplace Category + SubCategory)

```python
MAX_CATEGORY_DEPTH = 4  # constante, configurable

class Category(models.Model):
    store  = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='categories')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    name   = models.CharField(max_length=100)
    slug   = models.SlugField()
    order  = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [['store', 'parent', 'slug']]

    def clean(self):
        # Vérifier que la profondeur (en remontant les parents) ne dépasse pas MAX_CATEGORY_DEPTH
        depth = 1
        node = self.parent
        while node is not None:
            depth += 1
            if depth > MAX_CATEGORY_DEPTH:
                raise ValidationError(f"Profondeur maximale de {MAX_CATEGORY_DEPTH} niveaux dépassée.")
            node = node.parent

    def delete(self, *args, **kwargs):
        if self.children.exists() or self.products.exists():
            raise ProtectedError("Catégorie non vide : contient des sous-catégories ou des produits.", self)
        super().delete(*args, **kwargs)
```

- Un seul modèle auto-référencé, pas 3 modèles séparés. Profondeur fixe imposée en validation (4 niveaux), pas dans la structure des tables.
- Suppression bloquée si la catégorie a des enfants ou des produits rattachés (message d'erreur explicite retourné à l'API, pas de cascade silencieuse).

### 1.3 `catalog/models.py` — Product (modifié)

```python
class Product(models.Model):
    store          = models.ForeignKey(Store, on_delete=models.PROTECT, related_name='products')
    category       = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    sku            = models.CharField(max_length=64)
    slug           = models.SlugField()
    name           = models.CharField(max_length=200)
    selling_price  = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)  # indicatif
    stock_quantity = models.IntegerField(default=0)
    # ... autres champs inchangés (description, image, etc.)

    class Meta:
        unique_together = [['store', 'sku'], ['store', 'slug']]

    # SUPPRIMÉ : purchase_price
    # SUPPRIMÉ : property margin
    # SUPPRIMÉ : property margin_percent
```

- `store` : obligatoire, **non modifiable après création** (pas de transfert de produit entre boutiques dans cette version — prévu en backlog, voir section 8).
- `selling_price` : optionnel, purement indicatif. Sert de valeur de pré-remplissage suggérée dans le formulaire de vente, jamais imposée.
- `purchase_price` et les deux propriétés de marge : supprimés entièrement.

### 1.4 `sales/models.py` — Sale / SaleItem (modifié)

```python
class Sale(models.Model):
    invoice_number = models.CharField(max_length=30, unique=True)  # unicité globale, PAS par boutique
    # ... reste inchangé (client, date, is_cancelled, etc.)
    # PAS de champ store sur Sale : une vente peut contenir des produits des deux boutiques.

class SaleItem(models.Model):
    sale         = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product      = models.ForeignKey('catalog.Product', on_delete=models.SET_NULL, null=True, related_name='sale_items')
    product_name = models.CharField(max_length=200)   # snapshot déjà existant
    quantity     = models.PositiveIntegerField()
    unit_price   = models.DecimalField(max_digits=12, decimal_places=0)  # OBLIGATOIRE, saisi manuellement à la vente

    # SUPPRIMÉ : purchase_price (plus de snapshot marge)
```

- **Important** : `SaleItem.product` passe de `on_delete=PROTECT` à `on_delete=SET_NULL` (avec `null=True`). C'est plus sûr pour l'avenir : si un produit est un jour supprimé, l'historique de vente (déjà snapshoté via `product_name`) reste intact et affichable, seule la relation FK devient nulle.
- `unit_price` reste le prix réellement négocié à la vente, saisi manuellement à chaque fois (le frontend peut pré-remplir avec `product.selling_price` comme suggestion, mais rien n'impose cette valeur côté backend).
- Aucun champ `store` sur `Sale` : la boutique de chaque ligne est déductible via `SaleItem.product.store`. Pas de garde-fou à ajouter — mélanger les boutiques dans une même vente est un comportement voulu.

### 1.5 `sales/models.py` — RestockItem (modifié)

```python
class RestockItem(models.Model):
    restock  = models.ForeignKey(Restock, on_delete=models.CASCADE, related_name='items')
    product  = models.ForeignKey('catalog.Product', on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()

    # SUPPRIMÉ : purchase_price — plus aucun coût tracké, même au réapprovisionnement
```

- Le réapprovisionnement ne trace plus que des quantités. Aucun montant financier n'est saisi ni stocké nulle part dans le système.

---

## 2. Migrations & stratégie de données

Contexte : environnement de développement, 9 produits, 9 catégories, 0 sous-catégories, 7 ventes.

1. **Catalogue (Product, Category, SubCategory)** : flush complet des tables. Le client ressaisira manuellement son catalogue dans la nouvelle structure via l'UI, boutique par boutique. Ne pas écrire de script de migration de données produit — inutile vu le volume et le choix du client.
2. **Ventes existantes (Sale, SaleItem)** : à conserver si possible pour ne pas perdre l'historique de test, mais comme `SaleItem.product` passe en `SET_NULL`, exécuter la migration schéma AVANT le flush du catalogue, dans cet ordre :
   - Migration 1 : ajouter `Store`, modifier `SaleItem.product` en `SET_NULL` nullable, supprimer `SaleItem.purchase_price`, `Product.purchase_price`, `RestockItem.purchase_price`.
   - Migration 2 : remplacer `Category`/`SubCategory` par le nouveau modèle `Category` auto-référencé (table entièrement recréée, pas de migration de données de l'ancienne vers la nouvelle).
   - Flush manuel des tables `catalog_product`, `catalog_category` (ancienne), `catalog_subcategory` après application des migrations.
3. Créer une boutique par défaut à la première utilisation (l'utilisateur pourra la renommer, et en créer une seconde).

---

## 3. Contraintes d'unicité — récapitulatif

| Champ | Avant | Après |
|---|---|---|
| `Product.sku` | `unique=True` global | `unique_together=[store, sku]` |
| `Product.slug` | `unique=True` global | `unique_together=[store, slug]` |
| `Category.slug` | `unique=True` global | `unique_together=[store, parent, slug]` |
| `Sale.invoice_number` | `unique=True` global | **inchangé**, reste global (une vente peut couvrir les deux boutiques, pas de numérotation par boutique) |

---

## 4. API — endpoints à ajouter/modifier

- `Store` : CRUD standard, sauf `DELETE` désactivé (retirer le mixin/méthode `destroy`, retourner 405).
- `Category` : CRUD avec validation de profondeur (`clean()` appelé avant save), endpoint arborescence complet par boutique : `GET /api/catalog/categories/tree/?store=<id>` retournant la structure imbriquée en une seule requête (éviter le N+1 : `select_related`/`prefetch_related` récursif ou construction en mémoire après un seul `fetch all + group by parent_id`).
- `Product` : formulaire de création avec `store` + `category` pré-remplissables selon le point d'entrée (voir section 6). Combobox catégorie "créable à la volée".
- `Restock` : pré-remplissage de quantité suggérée éventuellement, mais plus de coût à pré-remplir.
- Export :
  - `GET /api/export/products/?store=<id>` → catalogue d'une boutique, colonne "Chemin catégorie" reconstituée (ex: `Accessoire Informatique > Clé USB`).
  - `GET /api/export/products/` (sans filtre) → export stock global toutes boutiques, avec colonne "Boutique".
- Rapports (`reports/views.py`) : ajouter un paramètre optionnel `?store=<id>` sur les endpoints de CA, agrégeant sur `SaleItem.product__store` plutôt que sur un champ `Sale.store` inexistant. Sans le paramètre, CA global toutes boutiques confondues (comportement actuel inchangé par défaut).

---

## 5. Logique métier clé

- **Atomicité** : conserver le pattern `transaction.atomic()` déjà en place. Adapter la cascade de `Product.destroy()` existante si nécessaire (elle référence déjà `SaleItem`, `QuotationItem`, `RestockItem`, `StockMovement`, `StockAlert` — vérifier qu'aucune ne casse avec les nouveaux `on_delete`).
- **Suppression de catégorie** : bloquée si non vide (voir `Category.delete()` en section 1.2), erreur claire remontée à l'API (400 avec message explicite, pas 500).
- **Suppression de boutique** : totalement désactivée au niveau API, pas seulement UI.

---

## 6. Frontend — composants et flux

### 6.1 Catalogue — deux vues

- **Vue "Liste"** (reprend `CatalogPage.jsx` existant) : filtres `store` + `category` (cascade sur l'arbre) envoyés à l'API, tri backend via `django_filters` comme aujourd'hui.
- **Vue "Arborescence"** : nouveau composant récursif `CategoryTree.jsx`, réutilisable pour les deux boutiques. Navigation par clic (drill-down), avec à chaque nœud deux boutons contextuels : "+ Ajouter un produit ici" et "+ Ajouter une sous-catégorie ici" (désactivé si profondeur max atteinte).

### 6.2 Formulaire produit

- Deux points d'entrée :
  - Depuis l'arborescence : `store` et `category` pré-remplis, non modifiables dans ce contexte (ou modifiables mais avec les valeurs de départ correctes).
  - Depuis la vue Liste, bouton global "+ Nouveau produit" : sélecteur boutique, puis sélecteur catégorie en cascade filtré sur la boutique choisie.
- Combobox catégorie "créable à la volée" (pattern type react-select `Creatable`) pour construire l'arborescence sans repasser par la vue dédiée. Validation de profondeur côté frontend (confort) ET backend (garantie).

### 6.3 Point de vente (POS)

- **Pas de verrouillage "boutique active"** sur le panier. Un filtre boutique dans la recherche produit du POS sert uniquement à faciliter la recherche (optionnel, défaut "Toutes les boutiques"), jamais à restreindre l'ajout au panier.
- Chaque ligne du panier affiche un badge boutique (ex: pastille de couleur ou libellé court) pour que le vendeur identifie visuellement l'origine de chaque article.
- Prix de vente : champ éditable pour chaque ligne, pré-rempli avec `product.selling_price` si disponible, sinon vide et saisie obligatoire.

### 6.4 Filtres boutique par page (pas de contexte global imposé)

- Catalogue, Stock, Rapports : chaque page a son propre filtre boutique optionnel (dropdown "Toutes les boutiques" / "Boutique 1" / "Boutique 2"), la dernière sélection peut être mémorisée en `localStorage` par page pour le confort, mais ce n'est jamais un verrou fonctionnel.

---

## 7. Tests à mettre à jour

- Factories : ajouter `StoreFactory`, adapter `ProductFactory` et `CategoryFactory` pour le nouveau modèle auto-référencé.
- Nouveaux cas à couvrir :
  - Validation de profondeur de catégorie (doit lever une erreur au-delà de 4 niveaux).
  - Suppression de catégorie non vide → doit échouer proprement.
  - Suppression de boutique → doit être bloquée (405 ou erreur explicite).
  - Vente avec des `SaleItem` de deux boutiques différentes dans la même `Sale` → doit réussir sans erreur.
  - Suppression d'un produit ayant des ventes historiques → `SaleItem.product` doit passer à `null` sans erreur, `product_name` doit rester affichable.
  - Export catalogue filtré par boutique et export stock global.

---

## 8. Hors scope (backlog, pas dans cette version)

- Transfert d'un produit d'une boutique à l'autre (changement de `Product.store` après création). Si besoin un jour : traiter comme une fonctionnalité à part entière (gestion du stock, de l'historique, de la catégorie associée), pas un simple changement de FK.
