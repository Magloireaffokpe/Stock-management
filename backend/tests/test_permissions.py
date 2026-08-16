"""
Tests — Modèle de permissions (Employé vs Admin).

Couvre le modèle demandé :
- Les employés sont en lecture seule sur les boutiques (stores).
- Les employés sont en lecture seule sur les catégories/sous-catégories de chaque boutique.
- Les employés voient TOUS les produits du Catalogue (toutes boutiques).
- Au POS, l'employé peut librement saisir le prix de vente de n'importe quel produit.
- Les employés ne peuvent PAS créer/modifier/supprimer stores, catégories ou produits.
- Les admins conservent toutes ces capacités.
"""

from decimal import Decimal

from rest_framework import status

from apps.catalog.models import Category, Product
from apps.stores.models import Store
from .base import BaseTestCase
from .factories import make_store, make_category, make_product


# ═══════════════════════════════════════════════════════════════════
#  BOUTIQUES — lecture seule pour l'employé
# ═══════════════════════════════════════════════════════════════════


class StorePermissionTest(BaseTestCase):

    def test_employé_voit_toutes_les_boutiques(self):
        s1 = make_store(name="Store A Permission")
        s2 = make_store(name="Store B Permission")
        r = self.employee_client.get("/api/stores/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        names = [s["name"] for s in r.data["results"]]
        self.assertIn(s1.name, names)
        self.assertIn(s2.name, names)

    def test_employé_ne_peut_pas_créer_boutique(self):
        r = self.employee_client.post("/api/stores/", {"name": "Boutique Interdite"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Store.objects.filter(name="Boutique Interdite").exists())

    def test_employé_ne_peut_pas_modifier_boutique(self):
        s = make_store(name="Boutique Non Modifiable")
        r_patch = self.employee_client.patch(f"/api/stores/{s.pk}/", {"name": "Hackée"}, format="json")
        self.assertEqual(r_patch.status_code, status.HTTP_403_FORBIDDEN)
        r_put = self.employee_client.put(f"/api/stores/{s.pk}/", {"name": "Hackée"}, format="json")
        self.assertEqual(r_put.status_code, status.HTTP_403_FORBIDDEN)
        s.refresh_from_db()
        self.assertEqual(s.name, "Boutique Non Modifiable")

    def test_employé_ne_peut_pas_supprimer_boutique(self):
        s = make_store(name="Boutique Non Supprimable")
        r = self.employee_client.delete(f"/api/stores/{s.pk}/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Store.objects.filter(pk=s.pk).exists())

    def test_admin_peut_créer_et_modifier_boutique(self):
        r = self.admin_client.post("/api/stores/", {"name": "Boutique Admin OK"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        store_id = r.data["id"]
        r_patch = self.admin_client.patch(f"/api/stores/{store_id}/", {"name": "Boutique Admin Renommée"}, format="json")
        self.assertEqual(r_patch.status_code, status.HTTP_200_OK)


# ═══════════════════════════════════════════════════════════════════
#  CATÉGORIES / SOUS-CATÉGORIES — lecture seule pour l'employé
# ═══════════════════════════════════════════════════════════════════


class CategoryPermissionTest(BaseTestCase):

    def setUp(self):
        super().setUp()
        self.store = make_store(name="Boutique Catégorie Perm")
        self.cat = make_category(name="Catégorie Parente Perm", store=self.store)
        self.child = make_category(name="Sous-catégorie Perm", store=self.store, parent=self.cat)

    def test_employé_voit_catégories_par_boutique(self):
        other = make_store(name="Autre Boutique Cat Perm")
        cat_other = make_category(name="Catégorie Autre Boutique", store=other)
        r = self.employee_client.get(f"/api/catalog/categories/?store={self.store.pk}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [c["id"] for c in r.data["results"]]
        self.assertIn(self.cat.pk, ids)
        self.assertIn(self.child.pk, ids)
        self.assertNotIn(cat_other.pk, ids)

    def test_employé_voit_sous_catégories_dans_arbre(self):
        r = self.employee_client.get(f"/api/catalog/categories/tree/?store={self.store.pk}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        root = next(n for n in r.data if n["id"] == self.cat.pk)
        self.assertEqual([c["id"] for c in root["children"]], [self.child.pk])

    def test_employé_ne_peut_pas_créer_catégorie(self):
        r = self.employee_client.post("/api/catalog/categories/", {
            "store": self.store.pk,
            "name": "Catégorie Interdite",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Category.objects.filter(name="Catégorie Interdite").exists())

    def test_employé_ne_peut_pas_créer_sous_catégorie(self):
        r = self.employee_client.post("/api/catalog/categories/", {
            "store": self.store.pk,
            "parent": self.cat.pk,
            "name": "Sous-catégorie Interdite",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Category.objects.filter(name="Sous-catégorie Interdite").exists())

    def test_employé_ne_peut_pas_modifier_catégorie(self):
        r = self.employee_client.patch(f"/api/catalog/categories/{self.cat.pk}/", {"name": "Hackée"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.cat.refresh_from_db()
        self.assertEqual(self.cat.name, "Catégorie Parente Perm")

    def test_employé_ne_peut_pas_supprimer_catégorie(self):
        r = self.employee_client.delete(f"/api/catalog/categories/{self.child.pk}/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Category.objects.filter(pk=self.child.pk).exists())

    def test_admin_peut_créer_et_modifier_catégorie(self):
        r = self.admin_client.post("/api/catalog/categories/", {
            "store": self.store.pk,
            "name": "Catégorie Admin OK",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        cat_id = r.data["id"]
        r_patch = self.admin_client.patch(f"/api/catalog/categories/{cat_id}/", {"name": "Catégorie Admin Renommée"}, format="json")
        self.assertEqual(r_patch.status_code, status.HTTP_200_OK)


# ═══════════════════════════════════════════════════════════════════
#  PRODUITS — lecture seule pour l'employé, tous les produits visibles
# ═══════════════════════════════════════════════════════════════════


class ProductPermissionTest(BaseTestCase):

    def setUp(self):
        super().setUp()
        self.store1 = make_store(name="Boutique Produits A")
        self.store2 = make_store(name="Boutique Produits B")
        self.cat1 = make_category(name="Cat Produits A", store=self.store1)
        self.cat2 = make_category(name="Cat Produits B", store=self.store2)
        self.p1 = make_product(name="Produit Boutique A Perm", store=self.store1, category=self.cat1)
        self.p2 = make_product(name="Produit Boutique B Perm", store=self.store2, category=self.cat2)

    def test_employé_voit_tous_les_produits_des_deux_boutiques(self):
        """L'employé voit TOUT le catalogue, sans filtre de boutique"""
        r = self.employee_client.get("/api/catalog/products/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [p["id"] for p in r.data["results"]]
        self.assertIn(self.p1.pk, ids)
        self.assertIn(self.p2.pk, ids)

    def test_employé_voit_les_produits_détaillés(self):
        r = self.employee_client.get(f"/api/catalog/products/{self.p1.pk}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["id"], self.p1.pk)

    def test_employé_ne_peut_pas_créer_produit(self):
        r = self.employee_client.post("/api/catalog/products/", {
            "store": self.store1.pk,
            "category": self.cat1.pk,
            "name": "Produit Interdit",
            "selling_price": "5000",
            "stock_quantity": 5,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Product.objects.filter(name="Produit Interdit").exists())

    def test_employé_ne_peut_pas_modifier_produit(self):
        r = self.employee_client.patch(f"/api/catalog/products/{self.p1.pk}/", {"name": "Hacké"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.p1.refresh_from_db()
        self.assertEqual(self.p1.name, "Produit Boutique A Perm")

    def test_employé_ne_peut_pas_supprimer_produit(self):
        r = self.employee_client.delete(f"/api/catalog/products/{self.p2.pk}/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Product.objects.filter(pk=self.p2.pk).exists())

    def test_admin_peut_modifier_et_supprimer_produit(self):
        r_patch = self.admin_client.patch(f"/api/catalog/products/{self.p1.pk}/", {"name": "Produit Admin OK"}, format="json")
        self.assertEqual(r_patch.status_code, status.HTTP_200_OK)
        r_delete = self.admin_client.delete(f"/api/catalog/products/{self.p2.pk}/")
        self.assertEqual(r_delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(pk=self.p2.pk).exists())


# ═══════════════════════════════════════════════════════════════════
#  POS — l'employé saisit librement le prix de vente
# ═══════════════════════════════════════════════════════════════════


class PosPricePermissionTest(BaseTestCase):

    def test_employé_vend_à_un_prix_inférieur_au_prix_référence(self):
        p = make_product(stock_quantity=10, selling_price=Decimal("50000"))
        r = self.employee_client.post("/api/sales/sales/create/", {
            "items": [{"product_id": p.pk, "quantity": 1, "unit_price": 45000}],
            "payment_method": "cash",
            "amount_paid": 45000,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(r.data["total_amount"]), Decimal("45000"))
        self.assertEqual(Decimal(r.data["items"][0]["unit_price"]), Decimal("45000"))

    def test_employé_vend_à_un_prix_supérieur_au_prix_référence(self):
        p = make_product(stock_quantity=10, selling_price=Decimal("50000"))
        r = self.employee_client.post("/api/sales/sales/create/", {
            "items": [{"product_id": p.pk, "quantity": 1, "unit_price": 62000}],
            "payment_method": "cash",
            "amount_paid": 62000,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(r.data["total_amount"]), Decimal("62000"))
        self.assertEqual(Decimal(r.data["items"][0]["unit_price"]), Decimal("62000"))

    def test_employé_peut_vendre_un_produit_de_n_importe_quelle_boutique(self):
        store_a = make_store(name="POS Boutique A")
        store_b = make_store(name="POS Boutique B")
        cat_a = make_category(store=store_a)
        cat_b = make_category(store=store_b)
        p_a = make_product(name="POS Produit A", store=store_a, category=cat_a, stock_quantity=5)
        p_b = make_product(name="POS Produit B", store=store_b, category=cat_b, stock_quantity=5)
        r = self.employee_client.post("/api/sales/sales/create/", {
            "items": [
                {"product_id": p_a.pk, "quantity": 1, "unit_price": 1000},
                {"product_id": p_b.pk, "quantity": 1, "unit_price": 2000},
            ],
            "payment_method": "cash",
            "amount_paid": 3000,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(r.data["total_amount"]), Decimal("3000"))
