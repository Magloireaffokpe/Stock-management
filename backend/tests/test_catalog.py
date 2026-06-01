"""
Tests — app catalog
Couvre : Modèles (SKU, slug, marge, statut stock), CRUD API (produits, catégories, fournisseurs)
"""
from decimal import Decimal

from rest_framework import status

from apps.catalog.models import Category, Product, Supplier
from .base import BaseTestCase
from .factories import make_category, make_supplier, make_product


# ═══════════════════════════════════════════════════════════════════
#  TESTS UNITAIRES — Modèles
# ═══════════════════════════════════════════════════════════════════

class CategoryModelTest(BaseTestCase):

    def test_slug_auto_généré(self):
        cat = Category.objects.create(name='Téléphones GSM Unique', icon='smartphone', order=1)
        self.assertIn('telephones', cat.slug)

    def test_product_count_propriété(self):
        cat = make_category(name='Cat Comptage')
        self.assertEqual(cat.product_count, 0)
        make_product(category=cat)
        make_product(category=cat)
        make_product(category=cat, is_active=False)
        cat_fresh = Category.objects.get(pk=cat.pk)
        self.assertEqual(cat_fresh.product_count, 2)

    def test_str_retourne_nom(self):
        cat = make_category(name='Mon Catalogue')
        self.assertEqual(str(cat), 'Mon Catalogue')


class SupplierModelTest(BaseTestCase):

    def test_product_count_propriété(self):
        sup = make_supplier(name='Fournisseur Comptage')
        self.assertEqual(sup.product_count, 0)
        make_product(supplier=sup)
        sup_fresh = Supplier.objects.get(pk=sup.pk)
        self.assertEqual(sup_fresh.product_count, 1)

    def test_str_retourne_nom(self):
        sup = make_supplier(name='Tech Bénin SARL')
        self.assertEqual(str(sup), 'Tech Bénin SARL')


class ProductModelTest(BaseTestCase):

    def test_sku_auto_généré_si_absent(self):
        cat = make_category()
        p = Product.objects.create(
            name='Laptop Test SKU',
            category=cat,
            purchase_price=Decimal('100000'),
            selling_price=Decimal('130000'),
            stock_quantity=5,
        )
        self.assertIsNotNone(p.sku)
        self.assertGreater(len(p.sku), 0)

    def test_calcul_marge_absolue(self):
        p = make_product(purchase_price=100000, selling_price=140000)
        self.assertEqual(p.margin, Decimal('40000'))

    def test_calcul_marge_pourcentage(self):
        p = make_product(purchase_price=100000, selling_price=150000)
        self.assertEqual(p.margin_percent, 50.0)

    def test_marge_pourcentage_achat_nul(self):
        p = make_product(purchase_price=0, selling_price=10000)
        self.assertEqual(p.margin_percent, 0)

    def test_stock_status_ok(self):
        p = make_product(stock_quantity=20, low_stock_threshold=5)
        self.assertEqual(p.stock_status, 'ok')

    def test_stock_status_low(self):
        p = make_product(stock_quantity=4, low_stock_threshold=5)
        self.assertEqual(p.stock_status, 'low')

    def test_stock_status_critical(self):
        p = make_product(stock_quantity=2, low_stock_threshold=5)
        self.assertEqual(p.stock_status, 'critical')

    def test_stock_status_out_of_stock(self):
        p = make_product(stock_quantity=0)
        self.assertEqual(p.stock_status, 'out_of_stock')

    def test_stock_status_négatif_compte_comme_rupture(self):
        p = make_product(stock_quantity=-1)
        self.assertEqual(p.stock_status, 'out_of_stock')

    def test_seuil_personnalisé_prioritaire_sur_seuil_global(self):
        p = make_product(stock_quantity=8, low_stock_threshold=10)
        self.assertEqual(p.stock_status, 'low')

    def test_soft_delete_via_api(self):
        p = make_product()
        r = self.admin_client.delete(f'/api/catalog/products/{p.pk}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        p.refresh_from_db()
        self.assertFalse(p.is_active)


# ═══════════════════════════════════════════════════════════════════
#  TESTS INTÉGRATION — API Catégories
# ═══════════════════════════════════════════════════════════════════

class CategoryAPITest(BaseTestCase):

    def test_liste_catégories_accessible_tous_connectés(self):
        r = self.employee_client.get('/api/catalog/categories/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_liste_retourne_catégories_avec_product_count(self):
        cat = make_category(name='Cat Avec Produits')
        make_product(category=cat)
        make_product(category=cat)
        r = self.admin_client.get('/api/catalog/categories/')
        # La réponse peut être paginée ou non
        results = r.data.get('results', r.data)
        cat_data = next((c for c in results if c['name'] == 'Cat Avec Produits'), None)
        self.assertIsNotNone(cat_data, 'Catégorie introuvable dans la réponse')
        self.assertEqual(cat_data['product_count'], 2)

    def test_créer_catégorie_admin_seulement(self):
        r_emp = self.employee_client.post('/api/catalog/categories/', {
            'name': 'Illégale', 'icon': 'box', 'color': '#000000', 'order': 99,
        }, format='json')
        self.assertEqual(r_emp.status_code, status.HTTP_403_FORBIDDEN)

        r_adm = self.admin_client.post('/api/catalog/categories/', {
            'name': 'Nouvelles Tablettes', 'icon': 'tablet', 'color': '#7C3AED', 'order': 8,
        }, format='json')
        self.assertEqual(r_adm.status_code, status.HTTP_201_CREATED)
        self.assertIn('slug', r_adm.data)

    def test_modifier_catégorie(self):
        cat = make_category(name='Ancien Nom Cat')
        r = self.admin_client.patch(f'/api/catalog/categories/{cat.pk}/', {
            'name': 'Nouveau Nom Cat',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        cat.refresh_from_db()
        self.assertEqual(cat.name, 'Nouveau Nom Cat')


# ═══════════════════════════════════════════════════════════════════
#  TESTS INTÉGRATION — API Produits
# ═══════════════════════════════════════════════════════════════════

class ProductAPITest(BaseTestCase):

    def test_liste_produits_accessible(self):
        r = self.employee_client.get('/api/catalog/products/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('count', r.data)
        self.assertIn('results', r.data)

    def test_liste_contient_champs_obligatoires(self):
        p = make_product()
        r = self.employee_client.get('/api/catalog/products/')
        results = r.data['results']
        prod = next((x for x in results if x['id'] == p.pk), None)
        self.assertIsNotNone(prod)
        for champ in ['id', 'name', 'sku', 'category', 'selling_price',
                      'stock_quantity', 'stock_status', 'margin', 'margin_percent']:
            self.assertIn(champ, prod)

    def test_créer_produit_admin(self):
        cat = make_category()
        r = self.admin_client.post('/api/catalog/products/', {
            'name': 'Nouveau Produit API',
            'category': cat.pk,
            'purchase_price': '50000',
            'selling_price': '70000',
            'stock_quantity': 10,
            'condition': 'new',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['name'], 'Nouveau Produit API')
        self.assertIsNotNone(r.data['sku'])

    def test_créer_produit_génère_mouvement_initial(self):
        from apps.stock.models import StockMovement
        cat = make_category()
        r = self.admin_client.post('/api/catalog/products/', {
            'name': 'Produit Mouvement Init',
            'category': cat.pk,
            'purchase_price': '10000',
            'selling_price': '15000',
            'stock_quantity': 25,
            'condition': 'new',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        product_id = r.data['id']
        self.assertTrue(
            StockMovement.objects.filter(
                product_id=product_id, movement_type='initial', quantity=25
            ).exists()
        )

    def test_filtre_stock_status_rupture(self):
        cat = make_category()
        p_ok  = make_product(name='En Stock OK', stock_quantity=10, category=cat)
        p_out = make_product(name='En Rupture TEST', stock_quantity=0, category=cat)
        r = self.admin_client.get('/api/catalog/products/?stock_status=out_of_stock')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(p_out.pk, ids)
        self.assertNotIn(p_ok.pk, ids)

    def test_filtre_par_catégorie(self):
        cat_a = make_category(name='Catégorie Alpha Test')
        cat_b = make_category(name='Catégorie Beta Test')
        p_a = make_product(category=cat_a)
        p_b = make_product(category=cat_b)
        r = self.admin_client.get(f'/api/catalog/products/?category={cat_a.pk}')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(p_a.pk, ids)
        self.assertNotIn(p_b.pk, ids)

    def test_recherche_par_nom(self):
        p = make_product(name='Samsung Galaxy ZZZUNIQUE Test')
        r = self.employee_client.get('/api/catalog/products/?search=ZZZUNIQUE')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(p.pk, ids)

    def test_produit_low_stock_endpoint(self):
        cat = make_category()
        p_ok  = make_product(name='OK Stock LS', stock_quantity=20, category=cat)
        p_low = make_product(name='Low Stock LS', stock_quantity=3, category=cat)
        p_out = make_product(name='Rupture LS', stock_quantity=0, category=cat)
        r = self.admin_client.get('/api/catalog/products/low-stock/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(p_low.pk, ids)
        self.assertIn(p_out.pk, ids)
        self.assertNotIn(p_ok.pk, ids)

    def test_recherche_rapide_pos(self):
        p = make_product(name='iPhone 15 Pro SEARCHTEST')
        r = self.employee_client.get('/api/catalog/products/search/?q=SEARCHTEST')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(p.pk, ids)

    def test_recherche_rapide_vide_retourne_rien(self):
        r = self.employee_client.get('/api/catalog/products/search/?q=')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data['results']), 0)

    def test_détail_produit_contient_specs_et_description(self):
        cat = make_category()
        p = Product.objects.create(
            name='Laptop Specs Test UNIQUE',
            category=cat,
            purchase_price=200000,
            selling_price=250000,
            stock_quantity=5,
            description='Description complète du produit',
            specifications={'RAM': '8 Go', 'SSD': '512 Go'},
        )
        r = self.admin_client.get(f'/api/catalog/products/{p.pk}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['description'], 'Description complète du produit')
        self.assertIn('RAM', r.data['specifications'])

    def test_sans_auth_retourne_401(self):
        r = self.client.get('/api/catalog/products/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
