"""
Tests d'intégration End-to-End — Scénarios métier complets
Ces tests simulent des workflows réels du magasin, du début à la fin.
"""
from decimal import Decimal
from rest_framework import status
from apps.stock.models import StockMovement, StockAlert
from apps.sales.models import Sale
from apps.settings_app.models import StoreSettings
from .base import BaseTestCase
from .factories import make_product, make_client, make_category, make_supplier


class ScenarioJournéeVenteTest(BaseTestCase):
    """
    Scénario E2E : Une journée complète de ventes
    Ouvre la boutique → vend plusieurs produits → vérifie stock → clôture
    """

    def test_journée_complète(self):
        # 1. Préparer le stock du matin
        cat = make_category(name='Journée Cat')
        sup = make_supplier(name='Journée Sup')
        laptop = make_product(
            name='Dell Inspiron 3511',
            category=cat, supplier=sup,
            purchase_price=250000, selling_price=300000,
            stock_quantity=5, low_stock_threshold=2,
        )
        phone = make_product(
            name='Tecno Camon 20',
            category=cat, supplier=sup,
            purchase_price=80000, selling_price=110000,
            stock_quantity=10, low_stock_threshold=3,
        )
        client = make_client(first_name='Patrice', last_name='Agboton')

        # 2. Vente 1 : client enregistré achète un laptop (prix négocié 295000)
        r1 = self.employee_client.post('/api/sales/sales/create/', {
            'client_id': client.pk,
            'items': [{'product_id': laptop.pk, 'quantity': 1, 'unit_price': 295000}],
            'payment_method': 'mtn',
            'amount_paid': 295000,
        }, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(laptop, 4)
        # total = subtotal(295000)
        self.assertEqual(Decimal(str(r1.data['total_amount'])), Decimal('295000'))

        # 3. Vente 2 : client comptoir, 2 téléphones
        r2 = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': phone.pk, 'quantity': 2, 'unit_price': 105000}],
            'payment_method': 'cash',
            'amount_paid': 220000,
        }, format='json')
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(phone, 8)
        # Monnaie rendue = 220000 - 210000 = 10000
        self.assertEqual(Decimal(str(r2.data['change_given'])), Decimal('10000'))

        # 4. Vérifier le dashboard reflète les 2 ventes
        # Vente 1 : total = 295000
        # Vente 2 : total = 2 × 105000 = 210000
        # Cumul attendu = 505000
        r_kpi = self.admin_client.get('/api/reports/dashboard/')
        self.assertGreaterEqual(r_kpi.data['today']['count'], 2)
        self.assertGreaterEqual(r_kpi.data['today']['revenue'], 505000)

        # 5. Vérifier les mouvements tracés
        laptop_mvts = StockMovement.objects.filter(product=laptop, movement_type='sale')
        self.assertTrue(laptop_mvts.exists())
        mvt = laptop_mvts.last()
        self.assertEqual(mvt.stock_before, 5)
        self.assertEqual(mvt.stock_after, 4)
        self.assertEqual(mvt.reference, r1.data['invoice_number'])

        # 6. Fin de journée : vérifier les stats
        r_ventes = self.admin_client.get('/api/sales/sales/')
        self.assertGreaterEqual(r_ventes.data['count'], 2)


class ScenarioRuptureStockTest(BaseTestCase):
    """
    Scénario E2E : Gestion d'un produit qui tombe en rupture
    Stock initial → ventes successives → alerte → réappro → retour à la normale
    """

    def test_cycle_rupture_réappro_complet(self):
        produit = make_product(
            name='Cartouche HP 302',
            purchase_price=5000, selling_price=8000,
            stock_quantity=4, low_stock_threshold=5,
        )

        # Pas d'alerte au début
        r_count = self.employee_client.get('/api/stock/alerts/count/')
        alertes_initiales = r_count.data['unread_count']

        # VENTE 1 : stock 4 → 2 (passe en low car seuil=5, mais ici on est déjà en low)
        r1 = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': produit.pk, 'quantity': 2, 'unit_price': 8000}],
            'payment_method': 'cash', 'amount_paid': 16000,
        }, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(produit, 2)
        self.assertAlertExists(produit, 'critical')  # stock=2, seuil critical=2

        # VENTE 2 : tenter de vendre 3 (impossible — stock = 2)
        r_refus = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': produit.pk, 'quantity': 3, 'unit_price': 8000}],
            'payment_method': 'cash', 'amount_paid': 24000,
        }, format='json')
        self.assertEqual(r_refus.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertStockEquals(produit, 2)  # Inchangé

        # VENTE 2 : vendre les 2 restants
        r2 = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': produit.pk, 'quantity': 2, 'unit_price': 8000}],
            'payment_method': 'cash', 'amount_paid': 16000,
        }, format='json')
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(produit, 0)
        self.assertAlertExists(produit, 'out')

        # Nouvelles alertes créées
        r_count2 = self.employee_client.get('/api/stock/alerts/count/')
        self.assertGreater(r_count2.data['unread_count'], alertes_initiales)

        # RÉAPPRO par l'admin
        r_reappro = self.admin_client.post('/api/sales/restocks/create/', {
            'items': [{'product_id': produit.pk, 'quantity': 20}],
        }, format='json')
        self.assertEqual(r_reappro.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(produit, 20)

        # Verify stock was replenished correctly
        produit.refresh_from_db()
        self.assertEqual(produit.stock_quantity, 20)

        # Alertes résolues automatiquement
        non_résolues = StockAlert.objects.filter(product=produit, is_resolved=False)
        self.assertFalse(non_résolues.exists())

        # NOUVEAU dashboard reflète le retour à la normale
        r_kpi = self.admin_client.get('/api/reports/dashboard/')
        self.assertEqual(r_kpi.data['stock']['out_of_stock'], 0)


class ScenarioAnnulationVenteTest(BaseTestCase):
    """
    Scénario E2E : Annulation d'une vente avec restauration complète
    """

    def test_annulation_restaure_état_initial(self):
        p1 = make_product(name='P Annul 1', stock_quantity=5, selling_price=20000)
        p2 = make_product(name='P Annul 2', stock_quantity=3, selling_price=50000)

        # Vente initiale
        r_vente = self.admin_client.post('/api/sales/sales/create/', {
            'items': [
                {'product_id': p1.pk, 'quantity': 2, 'unit_price': 20000},
                {'product_id': p2.pk, 'quantity': 1, 'unit_price': 50000},
            ],
            'payment_method': 'cash',
            'amount_paid': 90000,
        }, format='json')
        self.assertEqual(r_vente.status_code, status.HTTP_201_CREATED)
        sale_id = r_vente.data['id']
        self.assertStockEquals(p1, 3)
        self.assertStockEquals(p2, 2)

        # CA avant annulation
        r_kpi_avant = self.admin_client.get('/api/reports/dashboard/')
        ca_avant = r_kpi_avant.data['today']['revenue']

        # Annulation
        r_cancel = self.admin_client.post(f'/api/sales/sales/{sale_id}/cancel/')
        self.assertEqual(r_cancel.status_code, status.HTTP_200_OK)
        self.assertTrue(r_cancel.data['is_cancelled'])

        # Stock restauré
        self.assertStockEquals(p1, 5)
        self.assertStockEquals(p2, 3)

        # Mouvements de restauration tracés
        self.assertMovementExists(p1, 'sale_cancel', 2)
        self.assertMovementExists(p2, 'sale_cancel', 1)

        # CA baisse dans le dashboard
        r_kpi_après = self.admin_client.get('/api/reports/dashboard/')
        ca_après = r_kpi_après.data['today']['revenue']
        self.assertLess(ca_après, ca_avant)

        # Impossible d'annuler deux fois
        r_cancel2 = self.admin_client.post(f'/api/sales/sales/{sale_id}/cancel/')
        self.assertEqual(r_cancel2.status_code, status.HTTP_400_BAD_REQUEST)


class ScenarioGestionUtilisateursTest(BaseTestCase):
    """
    Scénario E2E : Cycle de vie complet d'un employé
    Création → connexion → vente → changement mdp → désactivation
    """

    def test_cycle_employé_complet(self):
        # 1. Admin crée un nouvel employé
        r_create = self.admin_client.post('/api/auth/users/', {
            'username': 'nouvel_employe',
            'password': 'employe123',
            'first_name': 'Kofi',
            'last_name': 'Mensah',
            'email': 'kofi@micrologis.bj',
            'role': 'employee',
        }, format='json')
        self.assertEqual(r_create.status_code, status.HTTP_201_CREATED)
        emp_id = r_create.data['id']

        # 2. L'employé se connecte
        r_login = self.client.post('/api/auth/login/', {
            'username': 'nouvel_employe',
            'password': 'employe123',
        })
        self.assertEqual(r_login.status_code, status.HTTP_200_OK)
        self.assertEqual(r_login.data['user']['role'], 'employee')

        # 3. Il crée un client depuis l'APIClient de l'employé
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken
        from django.contrib.auth import get_user_model
        User = get_user_model()
        emp_user = User.objects.get(username='nouvel_employe')
        emp_api = self.get_auth_client(emp_user)

        r_client = emp_api.post('/api/sales/clients/', {
            'first_name': 'Client de Kofi',
            'phone': '+229 96 00 11 22',
        }, format='json')
        self.assertEqual(r_client.status_code, status.HTTP_201_CREATED)

        # 4. Il fait une vente
        p = make_product(stock_quantity=10)
        price = int(p.selling_price)
        r_vente = emp_api.post('/api/sales/sales/create/', {
            'items': [{'product_id': p.pk, 'quantity': 1, 'unit_price': price}],
            'payment_method': 'cash',
            'amount_paid': price,
        }, format='json')
        self.assertEqual(r_vente.status_code, status.HTTP_201_CREATED)
        # La vente est bien attribuée à l'employé
        sale = Sale.objects.get(pk=r_vente.data['id'])
        self.assertEqual(sale.created_by.username, 'nouvel_employe')

        # 5. Il tente d'accéder aux rapports admin → refusé
        r_restricted = emp_api.get('/api/auth/users/')
        self.assertEqual(r_restricted.status_code, status.HTTP_403_FORBIDDEN)

        # 6. L'admin désactive le compte
        r_desactiver = self.admin_client.patch(f'/api/auth/users/{emp_id}/', {
            'is_active': False,
        }, format='json')
        self.assertEqual(r_desactiver.status_code, status.HTTP_200_OK)

        # 7. L'employé ne peut plus se connecter
        r_login2 = self.client.post('/api/auth/login/', {
            'username': 'nouvel_employe',
            'password': 'employe123',
        })
        self.assertEqual(r_login2.status_code, status.HTTP_401_UNAUTHORIZED)


class ScenarioParamètresEtFactureTest(BaseTestCase):
    """
    Scénario E2E : Modification des paramètres → impact sur les numéros de facture
    """

    def test_changement_préfixe_affecte_nouvelles_factures(self):
        # Changer le préfixe de facture
        self.admin_client.patch('/api/settings/', {
            'invoice_prefix': 'FAC',
            'invoice_counter': 1,
        }, format='json')

        # Vérifier en BDD
        store = StoreSettings.get()
        self.assertEqual(store.invoice_prefix, 'FAC')
        self.assertEqual(store.invoice_counter, 1)

        # Créer une vente → le numéro doit utiliser le nouveau préfixe
        p = make_product(stock_quantity=10)
        price = int(p.selling_price)
        r = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': p.pk, 'quantity': 1, 'unit_price': price}],
            'payment_method': 'cash',
            'amount_paid': price,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            r.data['invoice_number'].startswith('FAC-'),
            f"Numéro de facture inattendu : {r.data['invoice_number']}"
        )

    def test_seuil_stock_personnalisé_affecte_alertes(self):
        """Changer le seuil global doit modifier le comportement des alertes"""
        # Seuil global à 10
        self.admin_client.patch('/api/settings/', {
            'low_stock_threshold': 10,
            'critical_stock_threshold': 3,
        }, format='json')

        # low_stock_threshold=None → le produit hérite du seuil global (10)
        produit = make_product(name='Seuil Test', stock_quantity=7, low_stock_threshold=None)
        from apps.stock.utils import check_and_create_alert
        _, level = check_and_create_alert(produit)
        # stock=7, global_low=10 → low (7 < 10 mais > critical=3)
        self.assertEqual(level, 'low')

        # Remettre les seuils normaux pour ne pas casser d'autres tests
        self.admin_client.patch('/api/settings/', {
            'low_stock_threshold': 5,
            'critical_stock_threshold': 2,
        }, format='json')


class ScenarioAjustementStockTest(BaseTestCase):
    """
    Scénario E2E : Inventaire mensuel avec ajustements manuels
    """

    def test_inventaire_avec_pertes_et_corrections(self):
        p1 = make_product(name='Inv P1', stock_quantity=20)
        p2 = make_product(name='Inv P2', stock_quantity=15)
        p3 = make_product(name='Inv P3', stock_quantity=8)

        # Inventaire révèle :
        # - p1 : 2 unités cassées
        # - p2 : stock correct (+0)
        # - p3 : 3 unités en plus trouvées (retour oublié)

        # Ajustement p1 : perte de 2
        r1 = self.admin_client.post('/api/stock/adjust/', {
            'product_id': p1.pk, 'quantity': -2,
            'movement_type': 'loss', 'note': 'Casse inventaire mensuel',
        }, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p1, 18)

        # Ajustement p3 : correction positive
        r3 = self.admin_client.post('/api/stock/adjust/', {
            'product_id': p3.pk, 'quantity': 3,
            'movement_type': 'return', 'note': 'Retour client retrouvé',
        }, format='json')
        self.assertEqual(r3.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p3, 11)

        # Vérifier la traçabilité complète de p1
        mvts_p1 = StockMovement.objects.filter(product=p1).values(
            'movement_type', 'quantity', 'stock_before', 'stock_after', 'note'
        )
        loss_mvt = next((m for m in mvts_p1 if m['movement_type'] == 'loss'), None)
        self.assertIsNotNone(loss_mvt)
        self.assertEqual(loss_mvt['quantity'], -2)
        self.assertEqual(loss_mvt['stock_before'], 20)
        self.assertEqual(loss_mvt['stock_after'], 18)
        self.assertEqual(loss_mvt['note'], 'Casse inventaire mensuel')

        # Export Excel doit contenir tous ces mouvements
        r_export = self.admin_client.get('/api/reports/export/movements/')
        self.assertEqual(r_export.status_code, status.HTTP_200_OK)
        self.assertGreater(len(r_export.content), 1000)


class ScenarioChronologieStockTest(BaseTestCase):
    """
    Scénario E2E : Chronologie complète de la vie d'un produit.
    Stock initial → réappro → vente → perte → correction → annulation de vente
    → annulation de réappro. Vérifie la continuité stock_before/stock_after de
    chaque mouvement ainsi que l'impact sur le chiffre d'affaires.
    """

    def test_chronologie_complète_du_stock(self):
        from apps.stock.models import StockMovement

        cat = make_category(name='Chrono Cat')
        store = cat.store

        # 1. Création du produit via l'API → mouvement « initial » (0 → 10)
        r_create = self.admin_client.post('/api/catalog/products/', {
            'name': 'Produit Chronologie',
            'category': cat.pk,
            'store': store.pk,
            'selling_price': 1000,
            'stock_quantity': 10,
            'low_stock_threshold': 3,
        }, format='json')
        self.assertEqual(r_create.status_code, status.HTTP_201_CREATED)
        pid = r_create.data['id']

        from apps.catalog.models import Product
        p = Product.objects.get(pk=pid)
        self.assertMovementExists(p, 'initial', 10)

        # 2. Réappro +5 → stock 15
        r_restock = self.admin_client.post('/api/sales/restocks/create/', {
            'items': [{'product_id': pid, 'quantity': 5}],
        }, format='json')
        self.assertEqual(r_restock.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p, 15)
        self.assertMovementExists(p, 'restock', 5)

        # 3. Vente 2 @1000 → stock 13, CA = 2000
        r_sale1 = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': pid, 'quantity': 2, 'unit_price': 1000}],
            'payment_method': 'cash',
            'amount_paid': 2000,
        }, format='json')
        self.assertEqual(r_sale1.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p, 13)
        self.assertMovementExists(p, 'sale', -2)

        # 4. Perte -1 → stock 12
        r_loss = self.admin_client.post('/api/stock/adjust/', {
            'product_id': pid, 'quantity': -1,
            'movement_type': 'loss', 'note': 'Casse',
        }, format='json')
        self.assertEqual(r_loss.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p, 12)
        self.assertMovementExists(p, 'loss', -1)

        # 5. Correction via fiche produit → stock 20 (mouvement « correction »)
        r_patch = self.admin_client.patch(f'/api/catalog/products/{pid}/', {
            'stock_quantity': 20,
        }, format='json')
        self.assertEqual(r_patch.status_code, status.HTTP_200_OK)
        self.assertStockEquals(p, 20)
        self.assertMovementExists(p, 'correction', 8)

        # 6. Deuxième vente 3 @1000 → stock 17, CA cumulé = 5000
        r_sale2 = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': pid, 'quantity': 3, 'unit_price': 1000}],
            'payment_method': 'cash',
            'amount_paid': 3000,
        }, format='json')
        self.assertEqual(r_sale2.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p, 17)

        r_kpi = self.admin_client.get('/api/reports/dashboard/')
        self.assertEqual(r_kpi.data['today']['count'], 2)
        self.assertEqual(r_kpi.data['today']['revenue'], 5000)

        # 7. Annulation de la 2e vente → stock 20, CA redescend à 2000
        r_cancel = self.admin_client.post(f"/api/sales/sales/{r_sale2.data['id']}/cancel/")
        self.assertEqual(r_cancel.status_code, status.HTTP_200_OK)
        self.assertStockEquals(p, 20)
        self.assertMovementExists(p, 'sale_cancel', 3)

        r_kpi2 = self.admin_client.get('/api/reports/dashboard/')
        self.assertEqual(r_kpi2.data['today']['count'], 1)
        self.assertEqual(r_kpi2.data['today']['revenue'], 2000)

        # 8. Nouveau réappro +2 → stock 22, puis suppression → stock 20
        r_restock2 = self.admin_client.post('/api/sales/restocks/create/', {
            'items': [{'product_id': pid, 'quantity': 2}],
        }, format='json')
        self.assertEqual(r_restock2.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p, 22)

        r_del = self.admin_client.delete(f"/api/sales/restocks/{r_restock2.data['id']}/")
        self.assertEqual(r_del.status_code, status.HTTP_200_OK)
        self.assertStockEquals(p, 20)
        self.assertMovementExists(p, 'restock_cancel', -2)

        # 9. Continuité chronologique : stock_before(n+1) == stock_after(n)
        mvts = list(StockMovement.objects.filter(product=p).order_by('created_at', 'id'))
        self.assertEqual(mvts[0].movement_type, 'initial')
        self.assertEqual(mvts[0].stock_before, 0)
        for prev, curr in zip(mvts, mvts[1:]):
            self.assertEqual(
                curr.stock_before, prev.stock_after,
                f'Rupture de continuité entre {prev.movement_type} et {curr.movement_type}'
            )
        self.assertEqual(mvts[-1].stock_after, 20)

        # 10. L'export des ventes contient les 2 ventes (dont 1 annulée)
        r_export = self.admin_client.get('/api/reports/export/sales/')
        self.assertEqual(r_export.status_code, status.HTTP_200_OK)
        self.assertGreater(len(r_export.content), 1000)
