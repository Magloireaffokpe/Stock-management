"""
Classe de base partagée — fournit les helpers communs à tous les TestCase.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .factories import make_admin, make_employee, make_settings


class BaseTestCase(TestCase):
    """
    TestCase de base avec :
    - Paramètres magasin initialisés
    - Clients DRF pour admin et employé
    - Helper get_auth_client() pour tout utilisateur
    """

    @classmethod
    def setUpTestData(cls):
        """Appelé une seule fois pour toute la classe — plus rapide que setUp()"""
        cls.store = make_settings()
        cls.admin = make_admin()
        cls.employee = make_employee()

    def setUp(self):
        """Appelé avant chaque test — fournit les clients HTTP authentifiés"""
        self.client = APIClient()
        self.admin_client = self._build_client(self.admin)
        self.employee_client = self._build_client(self.employee)

    @staticmethod
    def _build_client(user):
        client = APIClient()
        refresh = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        return client

    def get_auth_client(self, user):
        return self._build_client(user)

    # ── Assertions métier utilitaires ────────────────────────────

    def assertStockEquals(self, product, expected_qty):
        product.refresh_from_db()
        self.assertEqual(
            product.stock_quantity, expected_qty,
            f'Stock de « {product.name} » : attendu {expected_qty}, obtenu {product.stock_quantity}'
        )

    def assertMovementExists(self, product, movement_type, quantity):
        from apps.stock.models import StockMovement
        qs = StockMovement.objects.filter(
            product=product,
            movement_type=movement_type,
            quantity=quantity,
        )
        self.assertTrue(
            qs.exists(),
            f'Mouvement {movement_type} qty={quantity} introuvable pour {product.name}'
        )

    def assertAlertExists(self, product, level):
        from apps.stock.models import StockAlert
        self.assertTrue(
            StockAlert.objects.filter(product=product, alert_level=level, is_resolved=False).exists(),
            f'Alerte {level} attendue pour {product.name}'
        )

    def assertNoAlert(self, product):
        from apps.stock.models import StockAlert
        self.assertFalse(
            StockAlert.objects.filter(product=product, is_resolved=False).exists(),
            f'Aucune alerte attendue pour {product.name}'
        )
