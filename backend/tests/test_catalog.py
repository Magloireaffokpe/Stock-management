"""
Tests — app catalog
Couvre : Modèles (SKU, slug, marge, statut stock), CRUD API (produits, catégories, fournisseurs)
"""

import unittest
from decimal import Decimal

from rest_framework import status

from apps.catalog.models import Category, Product, Supplier
from .base import BaseTestCase
from .factories import make_category, make_store, make_supplier, make_product

# ═══════════════════════════════════════════════════════════════════
#  TESTS UNITAIRES — Modèles
# ═══════════════════════════════════════════════════════════════════


class CategoryModelTest(BaseTestCase):

    def test_slug_auto_généré(self):
        store = make_store()
        cat = Category.objects.create(
            store=store, name="Téléphones GSM Unique", icon="smartphone", order=1
        )
        self.assertIn("telephones", cat.slug)

    def test_product_count_propriété(self):
        cat = make_category(name="Cat Comptage")
        self.assertEqual(cat.product_count, 0)
        make_product(category=cat)
        make_product(category=cat)
        make_product(category=cat, is_active=False)
        cat_fresh = Category.objects.get(pk=cat.pk)
        self.assertEqual(cat_fresh.product_count, 2)

    def test_str_retourne_nom(self):
        cat = make_category(name="Mon Catalogue")
        self.assertEqual(str(cat), "Mon Catalogue")


class SupplierModelTest(BaseTestCase):

    def test_product_count_propriété(self):
        sup = make_supplier(name="Fournisseur Comptage")
        self.assertEqual(sup.product_count, 0)
        make_product(supplier=sup)
        sup_fresh = Supplier.objects.get(pk=sup.pk)
        self.assertEqual(sup_fresh.product_count, 1)

    def test_str_retourne_nom(self):
        sup = make_supplier(name="Tech Bénin SARL")
        self.assertEqual(str(sup), "Tech Bénin SARL")


class ProductModelTest(BaseTestCase):

    def test_sku_auto_généré_si_absent(self):
        cat = make_category()
        p = Product.objects.create(
            store=cat.store,
            name="Laptop Test SKU",
            category=cat,
            selling_price=Decimal("130000"),
            stock_quantity=5,
        )
        self.assertIsNotNone(p.sku)
        self.assertGreater(len(p.sku), 0)

    @unittest.skip("Marge supprimée (spec : plus de prix d'achat)")
    def test_calcul_marge_absolue(self):
        pass

    @unittest.skip("Marge supprimée (spec : plus de prix d'achat)")
    def test_calcul_marge_pourcentage(self):
        pass

    @unittest.skip("Marge supprimée (spec : plus de prix d'achat)")
    def test_marge_pourcentage_achat_nul(self):
        pass

    def test_stock_status_ok(self):
        p = make_product(stock_quantity=20, low_stock_threshold=5)
        self.assertEqual(p.stock_status, "ok")

    def test_stock_status_low(self):
        p = make_product(stock_quantity=4, low_stock_threshold=5)
        self.assertEqual(p.stock_status, "low")

    def test_stock_status_critical(self):
        p = make_product(stock_quantity=2, low_stock_threshold=5)
        self.assertEqual(p.stock_status, "critical")

    def test_stock_status_out_of_stock(self):
        p = make_product(stock_quantity=0)
        self.assertEqual(p.stock_status, "out_of_stock")

    def test_stock_status_négatif_compte_comme_rupture(self):
        p = make_product(stock_quantity=-1)
        self.assertEqual(p.stock_status, "out_of_stock")

    def test_seuil_personnalisé_prioritaire_sur_seuil_global(self):
        p = make_product(stock_quantity=8, low_stock_threshold=10)
        self.assertEqual(p.stock_status, "low")

    def test_hard_delete_via_api(self):
        p = make_product()
        r = self.admin_client.delete(f"/api/catalog/products/{p.pk}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(pk=p.pk).exists())


# ═══════════════════════════════════════════════════════════════════
#  TESTS INTÉGRATION — API Catégories
# ═══════════════════════════════════════════════════════════════════


class CategoryAPITest(BaseTestCase):

    def test_liste_catégories_accessible_tous_connectés(self):
        r = self.employee_client.get("/api/catalog/categories/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_liste_retourne_catégories_avec_product_count(self):
        cat = make_category(name="Cat Avec Produits")
        make_product(category=cat)
        make_product(category=cat)
        r = self.admin_client.get("/api/catalog/categories/")
        # La réponse peut être paginée ou non
        results = r.data.get("results", r.data)
        cat_data = next((c for c in results if c["name"] == "Cat Avec Produits"), None)
        self.assertIsNotNone(cat_data, "Catégorie introuvable dans la réponse")
        self.assertEqual(cat_data["product_count"], 2)

    def test_créer_catégorie_admin_seulement(self):
        from apps.stores.models import Store
        store = make_store()
        r_emp = self.employee_client.post(
            "/api/catalog/categories/",
            {
                "name": "Illégale",
                "store": store.pk,
                "icon": "box",
                "color": "#000000",
                "order": 99,
            },
            format="json",
        )
        self.assertEqual(r_emp.status_code, status.HTTP_403_FORBIDDEN)

        r_adm = self.admin_client.post(
            "/api/catalog/categories/",
            {
                "name": "Nouvelles Tablettes",
                "store": store.pk,
                "icon": "tablet",
                "color": "#7C3AED",
                "order": 8,
            },
            format="json",
        )
        self.assertEqual(r_adm.status_code, status.HTTP_201_CREATED)
        self.assertIn("slug", r_adm.data)

    def test_modifier_catégorie(self):
        cat = make_category(name="Ancien Nom Cat")
        r = self.admin_client.patch(
            f"/api/catalog/categories/{cat.pk}/",
            {
                "name": "Nouveau Nom Cat",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        cat.refresh_from_db()
        self.assertEqual(cat.name, "Nouveau Nom Cat")

    def test_category_depth_validation_limits(self):
        store = make_store()
        cat1 = make_category(store=store)
        cat2 = make_category(store=store, parent=cat1)
        cat3 = make_category(store=store, parent=cat2)
        cat4 = make_category(store=store, parent=cat3) # Level 4: Allowed
        
        # Level 5: Rejected by serializers / model clean
        r = self.admin_client.post(
            "/api/catalog/categories/",
            {
                "store": store.pk,
                "parent": cat4.pk,
                "name": "Level 5",
            },
            format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", r.data)

    def test_category_parent_store_mismatch(self):
        store1 = make_store()
        store2 = make_store()
        cat_store1 = make_category(store=store1)
        
        # Try to create category in store2 with parent in store1
        r = self.admin_client.post(
            "/api/catalog/categories/",
            {
                "store": store2.pk,
                "parent": cat_store1.pk,
                "name": "Mismatch Parent Store",
            },
            format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", r.data)

    def test_delete_non_empty_category_fails(self):
        store = make_store()
        cat = make_category(store=store)
        child = make_category(store=store, parent=cat)
        
        r = self.admin_client.delete(f"/api/catalog/categories/{cat.pk}/")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", r.data)

    def test_category_tree_endpoint_single_db_query(self):
        from django.test.utils import CaptureQueriesContext
        from django.db import connection
        
        store = make_store()
        cat1 = make_category(name="Root 1", store=store)
        cat2 = make_category(name="Child 1.1", store=store, parent=cat1)
        cat3 = make_category(name="Child 1.1.1", store=store, parent=cat2)
        cat4 = make_category(name="Root 2", store=store)
        
        # Test tree structure
        r = self.admin_client.get(f"/api/catalog/categories/tree/?store={store.pk}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        data = r.data
        self.assertEqual(len(data), 2)  # Two roots: Root 1, Root 2
        root1_data = next(x for x in data if x["id"] == cat1.pk)
        self.assertEqual(len(root1_data["children"]), 1)
        child11_data = root1_data["children"][0]
        self.assertEqual(child11_data["id"], cat2.pk)
        self.assertEqual(len(child11_data["children"]), 1)
        self.assertEqual(child11_data["children"][0]["id"], cat3.pk)

        # Test single DB Query
        with CaptureQueriesContext(connection) as ctx:
            r = self.admin_client.get(f"/api/catalog/categories/tree/?store={store.pk}")
            self.assertEqual(r.status_code, status.HTTP_200_OK)
        
        cat_queries = [q for q in ctx.captured_queries if "catalog_category" in q["sql"]]
        self.assertEqual(len(cat_queries), 1, "Exactly one query should be executed to fetch catalog categories.")


# ═══════════════════════════════════════════════════════════════════
#  TESTS INTÉGRATION — API Produits
# ═══════════════════════════════════════════════════════════════════


class ProductAPITest(BaseTestCase):

    def test_liste_produits_accessible(self):
        r = self.employee_client.get("/api/catalog/products/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("count", r.data)
        self.assertIn("results", r.data)

    def test_liste_contient_champs_obligatoires(self):
        p = make_product()
        r = self.employee_client.get("/api/catalog/products/")
        results = r.data["results"]
        prod = next((x for x in results if x["id"] == p.pk), None)
        self.assertIsNotNone(prod)
        for champ in [
            "id",
            "name",
            "sku",
            "category",
            "selling_price",
            "stock_quantity",
            "stock_status",
        ]:
            self.assertIn(champ, prod)

    def test_liste_cache_prix_achat_et_marge_pour_employee(self):
        p = make_product(
            purchase_price=Decimal("100000"), selling_price=Decimal("150000")
        )
        r = self.employee_client.get("/api/catalog/products/")
        results = r.data["results"]
        prod = next((x for x in results if x["id"] == p.pk), None)
        self.assertIsNotNone(prod)
        self.assertNotIn("purchase_price", prod)
        self.assertNotIn("margin", prod)
        self.assertNotIn("margin_percent", prod)

    def test_créer_produit_admin(self):
        cat = make_category()
        r = self.admin_client.post(
            "/api/catalog/products/",
            {
                "name": "Nouveau Produit API",
                "store": cat.store_id,
                "category": cat.pk,
                "selling_price": "70000",
                "stock_quantity": 10,
                "condition": "new",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["name"], "Nouveau Produit API")
        self.assertIsNotNone(r.data["sku"])

    @unittest.skip("Coût d'achat supprimé (spec : plus de prix d'achat); validation à réécrire")
    def test_créer_produit_sans_prix_achat_retourne_400(self):
        pass

    def test_créer_produit_génère_mouvement_initial(self):
        from apps.stock.models import StockMovement

        cat = make_category()
        r = self.admin_client.post(
            "/api/catalog/products/",
            {
                "name": "Produit Mouvement Init",
                "store": cat.store_id,
                "category": cat.pk,
                "selling_price": "15000",
                "stock_quantity": 25,
                "condition": "new",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        product_id = r.data["id"]
        self.assertTrue(
            StockMovement.objects.filter(
                product_id=product_id, movement_type="initial", quantity=25
            ).exists()
        )

    def test_filtre_stock_status_rupture(self):
        cat = make_category()
        p_ok = make_product(name="En Stock OK", stock_quantity=10, category=cat)
        p_out = make_product(name="En Rupture TEST", stock_quantity=0, category=cat)
        r = self.admin_client.get("/api/catalog/products/?stock_status=out_of_stock")
        ids = [p["id"] for p in r.data["results"]]
        self.assertIn(p_out.pk, ids)
        self.assertNotIn(p_ok.pk, ids)

    def test_filtre_par_catégorie(self):
        cat_a = make_category(name="Catégorie Alpha Test")
        cat_b = make_category(name="Catégorie Beta Test")
        p_a = make_product(category=cat_a)
        p_b = make_product(category=cat_b)
        r = self.admin_client.get(f"/api/catalog/products/?category={cat_a.pk}")
        ids = [p["id"] for p in r.data["results"]]
        self.assertIn(p_a.pk, ids)
        self.assertNotIn(p_b.pk, ids)

    def test_filtre_par_boutique(self):
        store1 = make_store(name="Filtre Store A")
        store2 = make_store(name="Filtre Store B")
        p_a = make_product(name="Produit Store A Test", store=store1)
        p_b = make_product(name="Produit Store B Test", store=store2)
        r = self.admin_client.get(f"/api/catalog/products/?store={store1.pk}")
        ids = [p["id"] for p in r.data["results"]]
        self.assertIn(p_a.pk, ids)
        self.assertNotIn(p_b.pk, ids)
        self.assertEqual(r.data["count"], 1)

    def test_filtre_boutique_inconnue_retourne_vide(self):
        r = self.admin_client.get("/api/catalog/products/?store=999999")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["count"], 0)

    def test_liste_contient_store_name(self):
        store = make_store(name="Boutique Sérénité")
        p = make_product(name="Produit Store Name Test", store=store)
        r = self.admin_client.get(f"/api/catalog/products/?search={p.name}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        result = next(x for x in r.data["results"] if x["id"] == p.pk)
        self.assertEqual(result["store_name"], "Boutique Sérénité")

    def test_catégories_filtrées_par_boutique(self):
        store1 = make_store(name="Cat Store A")
        store2 = make_store(name="Cat Store B")
        cat_a = make_category(name="Catégorie Boutique A", store=store1)
        cat_b = make_category(name="Catégorie Boutique B", store=store2)
        r = self.admin_client.get(f"/api/catalog/categories/?store={store1.pk}")
        ids = [c["id"] for c in r.data["results"]]
        self.assertIn(cat_a.pk, ids)
        self.assertNotIn(cat_b.pk, ids)

    def test_tree_contient_product_count_et_store_name(self):
        store = make_store(name="Tree Store Test")
        cat = make_category(name="Tree Cat Test", store=store)
        make_product(name="Tree Product Test", category=cat, store=store)
        r = self.admin_client.get(f"/api/catalog/categories/tree/?store={store.pk}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 1)
        node = r.data[0]
        self.assertEqual(node["product_count"], 1)
        self.assertEqual(node["store_name"], "Tree Store Test")

    def test_recherche_par_nom(self):
        p = make_product(name="Samsung Galaxy ZZZUNIQUE Test")
        r = self.employee_client.get("/api/catalog/products/?search=ZZZUNIQUE")
        ids = [x["id"] for x in r.data["results"]]
        self.assertIn(p.pk, ids)

    def test_produit_low_stock_endpoint(self):
        cat = make_category()
        p_ok = make_product(name="OK Stock LS", stock_quantity=20, category=cat)
        p_low = make_product(name="Low Stock LS", stock_quantity=3, category=cat)
        p_out = make_product(name="Rupture LS", stock_quantity=0, category=cat)
        r = self.admin_client.get("/api/catalog/products/low-stock/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [p["id"] for p in r.data["results"]]
        self.assertIn(p_low.pk, ids)
        self.assertIn(p_out.pk, ids)
        self.assertNotIn(p_ok.pk, ids)

    def test_recherche_rapide_pos(self):
        p = make_product(name="iPhone 15 Pro SEARCHTEST")
        r = self.employee_client.get("/api/catalog/products/search/?q=SEARCHTEST")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [x["id"] for x in r.data["results"]]
        self.assertIn(p.pk, ids)

    def test_recherche_rapide_vide_retourne_rien(self):
        r = self.employee_client.get("/api/catalog/products/search/?q=")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data["results"]), 0)

    def test_détail_produit_contient_specs_et_description(self):
        cat = make_category()
        p = Product.objects.create(
            store=cat.store,
            name="Laptop Specs Test UNIQUE",
            category=cat,
            selling_price=250000,
            stock_quantity=5,
            description="Description complète du produit",
            specifications={"RAM": "8 Go", "SSD": "512 Go"},
        )
        r = self.admin_client.get(f"/api/catalog/products/{p.pk}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["description"], "Description complète du produit")
        self.assertIn("RAM", r.data["specifications"])

    def test_sans_auth_retourne_401(self):
        r = self.client.get("/api/catalog/products/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_product_category_store_mismatch(self):
        store1 = make_store()
        store2 = make_store()
        cat_store1 = make_category(store=store1)
        
        # Create product in store2 with category in store1
        r = self.admin_client.post(
            "/api/catalog/products/",
            {
                "store": store2.pk,
                "category": cat_store1.pk,
                "name": "Mismatch Product Category Store",
                "selling_price": "5000",
                "stock_quantity": 10,
            },
            format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", r.data)

    def test_product_deletion_logic(self):
        store = make_store()
        cat = make_category(store=store)
        p = make_product(category=cat, store=store)
        
        # 1. Linked to RestockItem -> Deletion blocked
        from apps.sales.models import Restock, RestockItem
        restock = Restock.objects.create(created_by=self.admin)
        restock_item = RestockItem.objects.create(restock=restock, product=p, quantity=5)
        
        r = self.admin_client.delete(f"/api/catalog/products/{p.pk}/")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", r.data)
        
        # Remove restock item to allow next tests
        restock_item.delete()
        restock.delete()
        
        # 2. Linked to QuotationItem -> Deletion blocked
        from apps.sales.models import Quotation, QuotationItem
        quotation = Quotation.objects.create(created_by=self.admin, total_amount=0)
        quotation_item = QuotationItem.objects.create(quotation=quotation, product=p, quantity=2, unit_price=1000, subtotal=2000)
        
        r = self.admin_client.delete(f"/api/catalog/products/{p.pk}/")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", r.data)
        
        # Remove quotation item
        quotation_item.delete()
        quotation.delete()
        
        # 3. Create movements, alerts, and sale item
        from apps.stock.models import StockMovement, StockAlert
        from apps.sales.models import Sale, SaleItem
        
        movement = StockMovement.objects.create(product=p, movement_type="initial", quantity=10, stock_before=0, stock_after=10)
        alert = StockAlert.objects.create(product=p, alert_level="low", stock_at_alert=5)
        
        sale = Sale.objects.create(created_by=self.admin, subtotal=1000, tax_amount=0, total_amount=1000, amount_paid=1000)
        sale_item = SaleItem.objects.create(sale=sale, product=p, product_name=p.name, quantity=1, unit_price=1000, subtotal=1000)
        
        # Deletion succeeds
        r = self.admin_client.delete(f"/api/catalog/products/{p.pk}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify cascades: StockMovement and StockAlert deleted, SaleItem.product is NULL
        self.assertFalse(StockMovement.objects.filter(pk=movement.pk).exists())
        self.assertFalse(StockAlert.objects.filter(pk=alert.pk).exists())
        
        sale_item.refresh_from_db()
        self.assertIsNone(sale_item.product)
        self.assertEqual(sale_item.product_name, p.name)
