"""
Tests — app stock
Couvre : Mouvements (traçabilité), Alertes (création/résolution), Ajustement manuel,
         Utilitaires (check_and_create_alert, notify_stock_update)
"""
from decimal import Decimal

from rest_framework import status

from apps.stock.models import StockMovement, StockAlert
from apps.stock.utils import check_and_create_alert
from .base import BaseTestCase
from .factories import make_product, make_settings, make_sale


# ═══════════════════════════════════════════════════════════════════
#  TESTS UNITAIRES — Modèles et utilitaires
# ═══════════════════════════════════════════════════════════════════

class StockMovementModelTest(BaseTestCase):

    def test_str_représentation(self):
        p = make_product(name='Produit Mvt')
        m = StockMovement.objects.create(
            product=p,
            movement_type='sale',
            quantity=-3,
            stock_before=10,
            stock_after=7,
        )
        self.assertIn('Produit Mvt', str(m))
        self.assertIn('sale', str(m))

    def test_tri_par_date_décroissante(self):
        p = make_product()
        m1 = StockMovement.objects.create(
            product=p, movement_type='initial', quantity=10, stock_before=0, stock_after=10
        )
        m2 = StockMovement.objects.create(
            product=p, movement_type='adjustment', quantity=5, stock_before=10, stock_after=15
        )
        mvts = list(StockMovement.objects.filter(product=p))
        # Le plus récent doit être en premier
        self.assertEqual(mvts[0].pk, m2.pk)


class CheckAndCreateAlertTest(BaseTestCase):
    """Unitaire — fonction check_and_create_alert()"""

    def test_pas_dalerte_si_stock_ok(self):
        p = make_product(stock_quantity=20, low_stock_threshold=5)
        alert, level = check_and_create_alert(p)
        self.assertIsNone(alert)
        self.assertIsNone(level)
        self.assertNoAlert(p)

    def test_alerte_low_créée(self):
        """stock=4, seuil low=5, critical=2 → alerte 'low'"""
        p = make_product(stock_quantity=4, low_stock_threshold=5)
        alert, level = check_and_create_alert(p)
        self.assertEqual(level, 'low')
        self.assertIsNotNone(alert)
        self.assertAlertExists(p, 'low')

    def test_alerte_critical_créée(self):
        """stock=2, critical=2 → alerte 'critical'"""
        p = make_product(stock_quantity=2, low_stock_threshold=5)
        alert, level = check_and_create_alert(p)
        self.assertEqual(level, 'critical')
        self.assertAlertExists(p, 'critical')

    def test_alerte_out_créée(self):
        p = make_product(stock_quantity=0)
        alert, level = check_and_create_alert(p)
        self.assertEqual(level, 'out')
        self.assertAlertExists(p, 'out')

    def test_alerte_non_dupliquée(self):
        """Appels successifs → une seule alerte non résolue"""
        p = make_product(stock_quantity=0)
        check_and_create_alert(p)
        check_and_create_alert(p)
        check_and_create_alert(p)
        count = StockAlert.objects.filter(product=p, alert_level='out', is_resolved=False).count()
        self.assertEqual(count, 1)

    def test_alertes_résolues_si_stock_revenu_ok(self):
        p = make_product(stock_quantity=0)
        check_and_create_alert(p)
        self.assertAlertExists(p, 'out')

        # Stock remis à la normale
        p.stock_quantity = 20
        p.save()
        check_and_create_alert(p)

        # Toutes les alertes doivent être résolues
        non_resolues = StockAlert.objects.filter(product=p, is_resolved=False)
        self.assertFalse(non_resolues.exists())

    def test_stock_at_alert_enregistré(self):
        p = make_product(stock_quantity=1)
        alert, _ = check_and_create_alert(p)
        self.assertEqual(alert.stock_at_alert, 1)


class StockAlertModelTest(BaseTestCase):

    def test_str_représentation(self):
        p = make_product(name='Prod Alerte')
        a = StockAlert.objects.create(
            product=p, alert_level='low', stock_at_alert=3
        )
        self.assertIn('Prod Alerte', str(a))
        self.assertIn('low', str(a))

    def test_par_défaut_non_lu_non_résolu(self):
        p = make_product()
        a = StockAlert.objects.create(product=p, alert_level='out', stock_at_alert=0)
        self.assertFalse(a.is_read)
        self.assertFalse(a.is_resolved)


# ═══════════════════════════════════════════════════════════════════
#  TESTS INTÉGRATION — API Stock
# ═══════════════════════════════════════════════════════════════════

class StockAdjustmentAPITest(BaseTestCase):
    """Intégration — POST /api/stock/adjust/"""

    def test_ajustement_positif_incrémente_stock(self):
        p = make_product(name='Prod Adjust +', stock_quantity=10)
        r = self.admin_client.post('/api/stock/adjust/', {
            'product_id': p.pk,
            'quantity': 5,
            'movement_type': 'adjustment',
            'note': 'Correction inventaire',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p, 15)
        self.assertMovementExists(p, 'adjustment', 5)

    def test_ajustement_négatif_décrémente_stock(self):
        p = make_product(name='Prod Adjust -', stock_quantity=10)
        r = self.admin_client.post('/api/stock/adjust/', {
            'product_id': p.pk,
            'quantity': -4,
            'movement_type': 'loss',
            'note': 'Casse accidentelle',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertStockEquals(p, 6)
        self.assertMovementExists(p, 'loss', -4)

    def test_ajustement_négatif_bloqué_si_stock_insuffisant(self):
        p = make_product(stock_quantity=3)
        r = self.admin_client.post('/api/stock/adjust/', {
            'product_id': p.pk,
            'quantity': -10,
            'movement_type': 'adjustment',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('insuffisant', r.data['error'].lower())
        self.assertStockEquals(p, 3)  # Inchangé

    def test_ajustement_réservé_admin(self):
        p = make_product(stock_quantity=10)
        r = self.employee_client.post('/api/stock/adjust/', {
            'product_id': p.pk,
            'quantity': 1,
            'movement_type': 'adjustment',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertStockEquals(p, 10)

    def test_ajustement_trace_stock_avant_après(self):
        p = make_product(stock_quantity=15)
        self.admin_client.post('/api/stock/adjust/', {
            'product_id': p.pk,
            'quantity': -5,
            'movement_type': 'loss',
        }, format='json')
        mvt = StockMovement.objects.filter(product=p, movement_type='loss').last()
        self.assertEqual(mvt.stock_before, 15)
        self.assertEqual(mvt.stock_after, 10)

    def test_ajustement_crée_alerte_si_stock_faible(self):
        p = make_product(stock_quantity=10, low_stock_threshold=5)
        self.admin_client.post('/api/stock/adjust/', {
            'product_id': p.pk,
            'quantity': -7,  # → stock = 3 → low
            'movement_type': 'adjustment',
        }, format='json')
        self.assertAlertExists(p, 'low')

    def test_ajustement_produit_inexistant_retourne_404(self):
        r = self.admin_client.post('/api/stock/adjust/', {
            'product_id': 99999,
            'quantity': 1,
            'movement_type': 'adjustment',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)


class StockMovementAPITest(BaseTestCase):
    """Intégration — GET /api/stock/movements/"""

    def test_liste_mouvements_accessible(self):
        r = self.employee_client.get('/api/stock/movements/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_liste_contient_bons_champs(self):
        p = make_product(stock_quantity=10)
        StockMovement.objects.create(
            product=p, movement_type='initial',
            quantity=10, stock_before=0, stock_after=10
        )
        r = self.admin_client.get('/api/stock/movements/')
        if r.data['results']:
            mvt = r.data['results'][0]
            for champ in ['product', 'product_name', 'movement_type',
                          'quantity', 'stock_before', 'stock_after', 'created_at']:
                self.assertIn(champ, mvt)

    def test_filtre_par_produit(self):
        p1 = make_product(name='Prod Filtre 1', stock_quantity=10)
        p2 = make_product(name='Prod Filtre 2', stock_quantity=10)
        StockMovement.objects.create(
            product=p1, movement_type='initial', quantity=10, stock_before=0, stock_after=10
        )
        StockMovement.objects.create(
            product=p2, movement_type='initial', quantity=10, stock_before=0, stock_after=10
        )
        r = self.admin_client.get(f'/api/stock/movements/?product={p1.pk}')
        produit_ids = {m['product'] for m in r.data['results']}
        self.assertIn(p1.pk, produit_ids)
        self.assertNotIn(p2.pk, produit_ids)

    def test_historique_produit_spécifique(self):
        p = make_product(stock_quantity=10)
        StockMovement.objects.create(
            product=p, movement_type='initial', quantity=10, stock_before=0, stock_after=10
        )
        r = self.admin_client.get(f'/api/stock/movements/product/{p.pk}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = {m['product'] for m in r.data['results']}
        self.assertEqual(ids, {p.pk})


class StockAlertAPITest(BaseTestCase):
    """Intégration — API Alertes stock"""

    def test_liste_alertes_accessible_tous_connectés(self):
        r = self.employee_client.get('/api/stock/alerts/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_liste_alertes_non_résolues_seulement(self):
        p = make_product(stock_quantity=0)
        StockAlert.objects.create(product=p, alert_level='out', stock_at_alert=0)
        # Alerte résolue — ne doit pas apparaître
        p2 = make_product(name='P2 Résolu', stock_quantity=0)
        StockAlert.objects.create(
            product=p2, alert_level='out', stock_at_alert=0, is_resolved=True
        )
        r = self.admin_client.get('/api/stock/alerts/')
        ids = [a['product'] for a in r.data['results']]
        self.assertIn(p.pk, ids)
        self.assertNotIn(p2.pk, ids)

    def test_badge_count_alertes_non_lues(self):
        p = make_product(stock_quantity=0)
        StockAlert.objects.create(product=p, alert_level='out', stock_at_alert=0, is_read=False)
        r = self.employee_client.get('/api/stock/alerts/count/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(r.data['unread_count'], 1)

    def test_marquer_une_alerte_comme_lue(self):
        p = make_product(stock_quantity=0)
        alert = StockAlert.objects.create(product=p, alert_level='out', stock_at_alert=0)
        self.assertFalse(alert.is_read)

        r = self.employee_client.patch(f'/api/stock/alerts/{alert.pk}/read/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        alert.refresh_from_db()
        self.assertTrue(alert.is_read)

    def test_marquer_toutes_lues(self):
        p = make_product(stock_quantity=0)
        for _ in range(3):
            StockAlert.objects.create(product=p, alert_level='out', stock_at_alert=0, is_read=False)
        r = self.employee_client.post('/api/stock/alerts/read-all/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        non_lues = StockAlert.objects.filter(is_read=False).count()
        self.assertEqual(non_lues, 0)

    def test_résoudre_alerte_admin_seulement(self):
        p = make_product(stock_quantity=0)
        alert = StockAlert.objects.create(product=p, alert_level='out', stock_at_alert=0)

        r_emp = self.employee_client.patch(f'/api/stock/alerts/{alert.pk}/resolve/')
        self.assertEqual(r_emp.status_code, status.HTTP_403_FORBIDDEN)

        r_adm = self.admin_client.patch(f'/api/stock/alerts/{alert.pk}/resolve/')
        self.assertEqual(r_adm.status_code, status.HTTP_200_OK)
        alert.refresh_from_db()
        self.assertTrue(alert.is_resolved)
        self.assertTrue(alert.is_read)
