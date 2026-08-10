"""
Tests — app sales
Couvre : Modèles (numérotation, calculs), Signals (décrément/restauration/réappro),
         API ventes, API dévis, API réappro, Clients
"""
from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.catalog.models import Product
from apps.sales.models import Sale, SaleItem, Client, Restock, RestockItem, Quotation
from apps.stock.models import StockMovement, StockAlert
from .base import BaseTestCase
from .factories import make_product, make_client, make_sale, make_restock, make_supplier


# ═══════════════════════════════════════════════════════════════════
#  TESTS UNITAIRES — Modèles
# ═══════════════════════════════════════════════════════════════════

class ClientModelTest(BaseTestCase):

    def test_full_name_avec_prénom_et_nom(self):
        c = Client(first_name='Chloé', last_name='Koffi')
        self.assertEqual(c.full_name, 'Chloé Koffi')

    def test_full_name_vide_retourne_client_comptoir(self):
        c = Client()
        self.assertEqual(c.full_name, 'Client comptoir')

    def test_total_purchases_exclut_annulations(self):
        client = make_client()
        p = make_product(selling_price=50000, stock_quantity=20)
        vente_ok = make_sale(self.admin, client=client, items=[
            {'product': p, 'quantity': 1, 'unit_price': 50000}
        ])
        p2 = make_product(name='P Annulé', selling_price=30000, stock_quantity=10)
        vente_annulée = make_sale(self.admin, client=client, items=[
            {'product': p2, 'quantity': 1, 'unit_price': 30000}
        ])
        vente_annulée.is_cancelled = True
        vente_annulée.save()

        client.refresh_from_db()
        self.assertEqual(client.total_purchases, Decimal('50000'))

    def test_purchases_count_exclut_annulations(self):
        client = make_client()
        p1 = make_product(name='PP1', stock_quantity=10)
        p2 = make_product(name='PP2', stock_quantity=10)
        make_sale(self.admin, client=client, items=[{'product': p1, 'quantity': 1, 'unit_price': 10000}])
        v2 = make_sale(self.admin, client=client, items=[{'product': p2, 'quantity': 1, 'unit_price': 10000}])
        v2.is_cancelled = True
        v2.save()
        client.refresh_from_db()
        self.assertEqual(client.purchases_count, 1)


class SaleNumberingTest(BaseTestCase):
    """Numérotation automatique des factures"""

    def test_numéro_facture_auto_généré(self):
        p = make_product(stock_quantity=10)
        sale = make_sale(self.admin, items=[{'product': p, 'quantity': 1, 'unit_price': 10000}])
        self.assertIsNotNone(sale.invoice_number)
        self.assertTrue(sale.invoice_number.startswith('TEST-'))

    def test_numéros_factures_uniques(self):
        p1 = make_product(name='PU1', stock_quantity=20)
        p2 = make_product(name='PU2', stock_quantity=20)
        s1 = make_sale(self.admin, items=[{'product': p1, 'quantity': 1, 'unit_price': 10000}])
        s2 = make_sale(self.admin, items=[{'product': p2, 'quantity': 1, 'unit_price': 10000}])
        self.assertNotEqual(s1.invoice_number, s2.invoice_number)

    def test_compteur_incrémenté(self):
        from apps.settings_app.models import StoreSettings
        counter_before = StoreSettings.get().invoice_counter
        p = make_product(name='Prod Counter', stock_quantity=10)
        make_sale(self.admin, items=[{'product': p, 'quantity': 1, 'unit_price': 10000}])
        counter_after = StoreSettings.get().invoice_counter
        self.assertEqual(counter_after, counter_before + 1)


# ═══════════════════════════════════════════════════════════════════
#  TESTS SIGNALS — Automatisation stock
# ═══════════════════════════════════════════════════════════════════

class SaleSignalStockTest(BaseTestCase):
    """Signal SaleItem.post_save → décrémentation automatique"""

    def test_création_saleitem_décrémente_stock(self):
        p = make_product(name='Signal Test', stock_quantity=10)
        make_sale(self.admin, items=[{'product': p, 'quantity': 3, 'unit_price': 15000}])
        self.assertStockEquals(p, 7)

    def test_création_saleitem_crée_mouvement_sale(self):
        p = make_product(name='Signal Mvt', stock_quantity=10)
        make_sale(self.admin, items=[{'product': p, 'quantity': 2, 'unit_price': 15000}])
        self.assertMovementExists(p, 'sale', -2)

    def test_mouvement_référence_numéro_facture(self):
        p = make_product(stock_quantity=10)
        sale = make_sale(self.admin, items=[{'product': p, 'quantity': 1, 'unit_price': 10000}])
        mvt = StockMovement.objects.filter(product=p, movement_type='sale').last()
        self.assertEqual(mvt.reference, sale.invoice_number)

    def test_vente_multiple_items_décrémente_tous(self):
        p1 = make_product(name='Multi 1', stock_quantity=10)
        p2 = make_product(name='Multi 2', stock_quantity=8)
        make_sale(self.admin, items=[
            {'product': p1, 'quantity': 3, 'unit_price': 15000},
            {'product': p2, 'quantity': 5, 'unit_price': 20000},
        ])
        self.assertStockEquals(p1, 7)
        self.assertStockEquals(p2, 3)

    def test_signal_crée_alerte_si_stock_passe_en_low(self):
        """Vente qui amène le stock sous le seuil → alerte créée automatiquement"""
        p = make_product(name='Signal Alert', stock_quantity=6, low_stock_threshold=5)
        make_sale(self.admin, items=[{'product': p, 'quantity': 3, 'unit_price': 10000}])
        # Stock maintenant à 3 → low
        self.assertAlertExists(p, 'low')

    def test_signal_crée_alerte_critique(self):
        p = make_product(name='Signal Critical', stock_quantity=5, low_stock_threshold=5)
        make_sale(self.admin, items=[{'product': p, 'quantity': 4, 'unit_price': 10000}])
        # Stock à 1 → critical (seuil=2)
        self.assertAlertExists(p, 'critical')

    def test_signal_crée_alerte_rupture(self):
        p = make_product(name='Signal Rupture', stock_quantity=2)
        make_sale(self.admin, items=[{'product': p, 'quantity': 2, 'unit_price': 10000}])
        self.assertAlertExists(p, 'out')


class SaleCancelSignalTest(BaseTestCase):
    """Annulation de vente → restauration automatique du stock"""

    def test_annulation_restaure_stock(self):
        p = make_product(name='Cancel Restore', stock_quantity=10)
        sale = make_sale(self.admin, items=[{'product': p, 'quantity': 4, 'unit_price': 10000}])
        self.assertStockEquals(p, 6)  # Après vente

        # Annulation via l'API
        r = self.admin_client.post(f'/api/sales/sales/{sale.pk}/cancel/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertStockEquals(p, 10)  # Restauré

    def test_annulation_crée_mouvement_sale_cancel(self):
        p = make_product(name='Cancel Mvt', stock_quantity=10)
        sale = make_sale(self.admin, items=[{'product': p, 'quantity': 3, 'unit_price': 10000}])
        self.admin_client.post(f'/api/sales/sales/{sale.pk}/cancel/')
        self.assertMovementExists(p, 'sale_cancel', 3)

    def test_annulation_déjà_annulée_retourne_400(self):
        p = make_product(stock_quantity=10)
        sale = make_sale(self.admin, items=[{'product': p, 'quantity': 1, 'unit_price': 10000}])
        self.admin_client.post(f'/api/sales/sales/{sale.pk}/cancel/')
        # Deuxième annulation
        r = self.admin_client.post(f'/api/sales/sales/{sale.pk}/cancel/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_employé_peut_annuler_sa_propre_vente(self):
        p = make_product(stock_quantity=10)
        emp_client = self._build_client(self.employee)
        # Créer une vente en tant qu'employé
        sale = make_sale(self.employee, items=[{'product': p, 'quantity': 1, 'unit_price': 10000}])
        r = emp_client.post(f'/api/sales/sales/{sale.pk}/cancel/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_employé_ne_peut_pas_annuler_vente_dautri(self):
        p = make_product(stock_quantity=10)
        sale = make_sale(self.admin, items=[{'product': p, 'quantity': 1, 'unit_price': 10000}])
        r = self.employee_client.post(f'/api/sales/sales/{sale.pk}/cancel/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


class RestockSignalTest(BaseTestCase):
    """Signal RestockItem.post_save → incrémentation automatique du stock"""

    def test_réappro_incrémente_stock(self):
        p = make_product(name='Restock Incr', stock_quantity=5)
        make_restock(self.admin, product=p, quantity=10)
        self.assertStockEquals(p, 15)

    def test_réappro_crée_mouvement_restock(self):
        p = make_product(name='Restock Mvt', stock_quantity=5)
        make_restock(self.admin, product=p, quantity=8)
        self.assertMovementExists(p, 'restock', 8)

    def test_réappro_met_à_jour_prix_achat(self):
        p = make_product(purchase_price=10000, stock_quantity=5)
        make_restock(self.admin, product=p, quantity=5, unit_cost=12000)
        p.refresh_from_db()
        self.assertEqual(p.purchase_price, Decimal('12000'))

    def test_réappro_résout_alertes_existantes(self):
        from apps.stock.utils import check_and_create_alert
        p = make_product(stock_quantity=0)
        check_and_create_alert(p)
        self.assertAlertExists(p, 'out')
        # Réappro
        make_restock(self.admin, product=p, quantity=20)
        # L'alerte doit être résolue
        non_résolues = StockAlert.objects.filter(product=p, is_resolved=False)
        self.assertFalse(non_résolues.exists())


# ═══════════════════════════════════════════════════════════════════
#  TESTS INTÉGRATION — API Ventes
# ═══════════════════════════════════════════════════════════════════

class SaleCreateAPITest(BaseTestCase):
    """POST /api/sales/sales/create/"""

    def test_créer_vente_simple(self):
        p = make_product(stock_quantity=10, selling_price=50000)
        r = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': p.pk, 'quantity': 2, 'unit_price': 50000}],
            'payment_method': 'cash',
            'amount_paid': 100000,
            'discount': 0,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIn('invoice_number', r.data)
        self.assertEqual(len(r.data['items']), 1)
        self.assertStockEquals(p, 8)

    def test_créer_vente_avec_client(self):
        client = make_client(first_name='Ali', last_name='Moussa')
        p = make_product(stock_quantity=10)
        r = self.admin_client.post('/api/sales/sales/create/', {
            'client_id': client.pk,
            'items': [{'product_id': p.pk, 'quantity': 1, 'unit_price': 20000}],
            'payment_method': 'mtn',
            'amount_paid': 20000,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['client'], client.pk)

    def test_créer_vente_avec_remise(self):
        p = make_product(stock_quantity=10, selling_price=50000)
        r = self.admin_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': p.pk, 'quantity': 1, 'unit_price': 50000}],
            'payment_method': 'cash',
            'amount_paid': 45000,
            'discount': 5000,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(r.data['discount']), Decimal('5000'))
        self.assertEqual(Decimal(r.data['total_amount']), Decimal('45000'))

    def test_créer_vente_calcule_monnaie_rendue(self):
        p = make_product(stock_quantity=10, selling_price=40000)
        r = self.admin_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': p.pk, 'quantity': 1, 'unit_price': 40000}],
            'payment_method': 'cash',
            'amount_paid': 50000,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(r.data['change_given']), Decimal('10000'))

    def test_vente_bloquée_si_stock_insuffisant(self):
        p = make_product(stock_quantity=2)
        r = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': p.pk, 'quantity': 5, 'unit_price': 10000}],
            'payment_method': 'cash',
            'amount_paid': 50000,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('insuffisant', r.data['error'].lower())
        self.assertStockEquals(p, 2)  # Inchangé

    def test_vente_bloquée_produit_inexistant(self):
        r = self.employee_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': 99999, 'quantity': 1, 'unit_price': 10000}],
            'payment_method': 'cash',
            'amount_paid': 10000,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vente_vide_retourne_400(self):
        r = self.employee_client.post('/api/sales/sales/create/', {
            'items': [],
            'payment_method': 'cash',
            'amount_paid': 0,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vente_enregistre_prix_achat_snapshot(self):
        """Le purchase_price dans SaleItem doit être figé au moment de la vente"""
        p = make_product(purchase_price=10000, selling_price=15000, stock_quantity=10)
        sale_r = self.admin_client.post('/api/sales/sales/create/', {
            'items': [{'product_id': p.pk, 'quantity': 1, 'unit_price': 15000}],
            'payment_method': 'cash',
            'amount_paid': 15000,
        }, format='json')
        self.assertEqual(sale_r.status_code, status.HTTP_201_CREATED)
        sale = Sale.objects.get(pk=sale_r.data['id'])
        item = sale.items.first()
        self.assertEqual(item.purchase_price, Decimal('10000'))

        # Changer le prix du produit : ne doit pas affecter l'ancienne vente
        p.purchase_price = Decimal('99999')
        p.save()
        item.refresh_from_db()
        self.assertEqual(item.purchase_price, Decimal('10000'))

    def test_sans_auth_retourne_401(self):
        r = self.client.post('/api/sales/sales/create/', {
            'items': [], 'payment_method': 'cash', 'amount_paid': 0,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


class SaleListAPITest(BaseTestCase):
    """GET /api/sales/sales/"""

    def test_liste_accessible(self):
        r = self.employee_client.get('/api/sales/sales/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_filtre_non_annulées_par_défaut(self):
        p = make_product(stock_quantity=20)
        s_ok = make_sale(self.admin, items=[{'product': p, 'quantity': 1, 'unit_price': 10000}])
        # Annuler la suivante directement en BDD (sans signal pour ce test)
        s_cancel = Sale.objects.create(
            subtotal=0, total_amount=0, amount_paid=0, change_given=0,
            created_by=self.admin, is_cancelled=True,
            payment_method='cash', discount=0, tax_amount=0,
        )
        r = self.admin_client.get('/api/sales/sales/?is_cancelled=False')
        ids = [s['id'] for s in r.data['results']]
        self.assertIn(s_ok.pk, ids)
        self.assertNotIn(s_cancel.pk, ids)

    def test_filtre_par_méthode_paiement(self):
        p = make_product(stock_quantity=20)
        s_cash = make_sale(self.admin, items=[{'product': p, 'quantity': 1, 'unit_price': 10000}],
                           payment_method='cash')
        r = self.admin_client.get('/api/sales/sales/?payment_method=cash')
        ids = [s['id'] for s in r.data['results']]
        self.assertIn(s_cash.pk, ids)

    def test_employe_ne_voit_que_ses_ventes_des_7_derniers_jours(self):
        product = make_product(stock_quantity=20)
        own_recent = make_sale(
            self.employee, items=[{'product': product, 'quantity': 1, 'unit_price': 10000}]
        )
        other_recent = make_sale(
            self.admin, items=[{'product': product, 'quantity': 1, 'unit_price': 10000}]
        )
        own_old = make_sale(
            self.employee, items=[{'product': product, 'quantity': 1, 'unit_price': 10000}]
        )
        old_date = timezone.now() - timedelta(days=7)
        Sale.objects.filter(pk=own_old.pk).update(sale_date=old_date)

        response = self.employee_client.get('/api/sales/sales/')
        ids = [sale['id'] for sale in response.data['results']]

        self.assertIn(own_recent.pk, ids)
        self.assertNotIn(other_recent.pk, ids)
        self.assertNotIn(own_old.pk, ids)

    def test_admin_conserve_acces_a_l_historique_complet(self):
        product = make_product(stock_quantity=20)
        old_sale = make_sale(
            self.employee, items=[{'product': product, 'quantity': 1, 'unit_price': 10000}]
        )
        Sale.objects.filter(pk=old_sale.pk).update(
            sale_date=timezone.now() - timedelta(days=7)
        )

        response = self.admin_client.get('/api/sales/sales/')
        self.assertIn(old_sale.pk, [sale['id'] for sale in response.data['results']])


class SaleDetailAPITest(BaseTestCase):
    """GET /api/sales/sales/<id>/"""

    def test_détail_contient_items(self):
        p1 = make_product(name='Item A', stock_quantity=10)
        p2 = make_product(name='Item B', stock_quantity=10)
        sale = make_sale(self.admin, items=[
            {'product': p1, 'quantity': 1, 'unit_price': 15000},
            {'product': p2, 'quantity': 2, 'unit_price': 20000},
        ])
        r = self.admin_client.get(f'/api/sales/sales/{sale.pk}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data['items']), 2)

    def test_détail_contient_total_marge(self):
        p = make_product(purchase_price=10000, selling_price=15000, stock_quantity=10)
        sale = make_sale(self.admin, items=[{'product': p, 'quantity': 2, 'unit_price': 15000}])
        r = self.admin_client.get(f'/api/sales/sales/{sale.pk}/')
        self.assertIn('total_margin', r.data)
        # Marge = (15000 - 10000) × 2 = 10000
        self.assertEqual(Decimal(str(r.data['total_margin'])), Decimal('10000'))

    def test_employe_ne_peut_pas_ouvrir_une_vente_hors_de_sa_fenetre(self):
        product = make_product(stock_quantity=10)
        old_sale = make_sale(
            self.employee, items=[{'product': product, 'quantity': 1, 'unit_price': 10000}]
        )
        Sale.objects.filter(pk=old_sale.pk).update(
            sale_date=timezone.now() - timedelta(days=7)
        )

        response = self.employee_client.get(f'/api/sales/sales/{old_sale.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ═══════════════════════════════════════════════════════════════════
#  TESTS INTÉGRATION — API Réappros
# ═══════════════════════════════════════════════════════════════════

class RestockAPITest(BaseTestCase):
    """POST /api/sales/restocks/create/"""

    def test_créer_réappro_incrémente_stock(self):
        p = make_product(stock_quantity=5)
        r = self.admin_client.post('/api/sales/restocks/create/', {
            'items': [{'product_id': p.pk, 'quantity': 15, 'unit_cost': 9000}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p, 20)

    def test_créer_réappro_avec_fournisseur(self):
        sup = make_supplier(name='Supplier Réappro')
        p = make_product(stock_quantity=0)
        r = self.admin_client.post('/api/sales/restocks/create/', {
            'supplier_id': sup.pk,
            'items': [{'product_id': p.pk, 'quantity': 10, 'unit_cost': 8000}],
            'notes': 'Commande urgente',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['supplier'], sup.pk)

    def test_réappro_génère_référence(self):
        p = make_product(stock_quantity=0)
        r = self.admin_client.post('/api/sales/restocks/create/', {
            'items': [{'product_id': p.pk, 'quantity': 5, 'unit_cost': 10000}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(r.data['reference'])
        self.assertTrue(r.data['reference'].startswith('REAP-'))

    def test_réappro_calcule_coût_total(self):
        p1 = make_product(name='RT1', stock_quantity=0)
        p2 = make_product(name='RT2', stock_quantity=0)
        r = self.admin_client.post('/api/sales/restocks/create/', {
            'items': [
                {'product_id': p1.pk, 'quantity': 10, 'unit_cost': 5000},
                {'product_id': p2.pk, 'quantity': 5,  'unit_cost': 8000},
            ],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        # Total = 10×5000 + 5×8000 = 90000
        self.assertEqual(Decimal(str(r.data['total_cost'])), Decimal('90000'))

    def test_réappro_réservé_admin(self):
        p = make_product(stock_quantity=0)
        r = self.employee_client.post('/api/sales/restocks/create/', {
            'items': [{'product_id': p.pk, 'quantity': 5, 'unit_cost': 10000}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertStockEquals(p, 0)

    def test_réappro_produit_inexistant_retourne_400(self):
        r = self.admin_client.post('/api/sales/restocks/create/', {
            'items': [{'product_id': 99999, 'quantity': 5, 'unit_cost': 10000}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


# ═══════════════════════════════════════════════════════════════════
#  TESTS INTÉGRATION — API Clients
# ═══════════════════════════════════════════════════════════════════

class ClientAPITest(BaseTestCase):

    def test_créer_client(self):
        r = self.employee_client.post('/api/sales/clients/', {
            'first_name': 'Moussa',
            'last_name': 'Alabi',
            'phone': '+229 97 55 55 55',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['full_name'], 'Moussa Alabi')

    def test_recherche_client_par_nom(self):
        make_client(first_name='Ibrahim', last_name='Zongo')
        r = self.employee_client.get('/api/sales/clients/?search=Ibrahim')
        noms = [c['full_name'] for c in r.data['results']]
        self.assertIn('Ibrahim Zongo', noms)

    def test_liste_clients_accessible(self):
        r = self.employee_client.get('/api/sales/clients/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_détail_client_inclut_statistiques(self):
        client = make_client()
        r = self.admin_client.get(f'/api/sales/clients/{client.pk}/')
        self.assertIn('total_purchases', r.data)
        self.assertIn('purchases_count', r.data)
