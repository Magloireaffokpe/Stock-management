from decimal import Decimal
from django.urls import reverse
from rest_framework import status

from apps.catalog.models import Product
from apps.sales.models import Sale
from apps.stock.models import StockMovement
from apps.settings_app.models import StoreSettings
from tests.base import BaseTestCase
from tests.factories import make_product

class TransactionsAndCalculationsTest(BaseTestCase):
    
    def test_sale_rollback_on_insufficient_stock(self):
        """
        Vérifie que la transaction atomique annule TOUTE la vente
        si UN SEUL produit n'a pas assez de stock, et qu'aucun stock n'est décrémenté.
        """
        product_a = make_product(name="Produit A", selling_price=1000, stock_quantity=10)
        product_b = make_product(name="Produit B", selling_price=500, stock_quantity=2)
        
        url = reverse('sale-create')
        data = {
            "payment_method": "cash",
            "amount_paid": 2000,
            "items": [
                {"product_id": product_a.id, "quantity": 5, "unit_price": 1000},
                {"product_id": product_b.id, "quantity": 5, "unit_price": 500}, # Échouera car 5 > 2
            ]
        }
        
        response = self.admin_client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Stock insuffisant", str(response.data))
        
        # Vérification du rollback
        self.assertEqual(Sale.objects.count(), 0)
        product_a.refresh_from_db()
        product_b.refresh_from_db()
        self.assertEqual(product_a.stock_quantity, 10)  # Le stock de A n'a pas bougé
        self.assertEqual(product_b.stock_quantity, 2)   # Le stock de B n'a pas bougé


    def test_sale_tax_and_totals_calculation(self):
        """
        Vérifie que le calcul de la TVA s'applique bien sur le (Sous-total - Remise)
        et que le total général est correct.
        """
        # Configuration des taxes
        store = StoreSettings.get()
        store.tax_rate = Decimal('18.0')
        store.save()
        
        product_a = make_product(selling_price=1000, stock_quantity=10)
        product_b = make_product(selling_price=2000, stock_quantity=10)
        
        url = reverse('sale-create')
        data = {
            "payment_method": "cash",
            "discount": 500,
            "amount_paid": 2950,
            "items": [
                {"product_id": product_a.id, "quantity": 1, "unit_price": 1000},
                {"product_id": product_b.id, "quantity": 1, "unit_price": 2000},
            ]
        }
        
        response = self.admin_client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        sale = Sale.objects.get(id=response.data['id'])
        
        self.assertEqual(sale.subtotal, Decimal('3000.0'))
        self.assertEqual(sale.discount, Decimal('500.0'))
        # Base taxable = 3000 - 500 = 2500, 18% de 2500 = 450
        self.assertEqual(sale.tax_amount, Decimal('450.0'))
        self.assertEqual(sale.total_amount, Decimal('2950.0'))
        self.assertEqual(sale.change_given, Decimal('0.0'))


    def test_product_update_generates_stock_movement(self):
        """
        Vérifie que la modification manuelle de stock_quantity via ProductDetailView
        génère bien un StockMovement de type 'correction'.
        """
        product = make_product(stock_quantity=10)
        # Supprimer le mouvement initial (créé par la factory) pour simplifier le test
        StockMovement.objects.all().delete()
        
        url = reverse('product-detail', kwargs={'pk': product.id})
        data = {
            "stock_quantity": 15
        }
        
        response = self.admin_client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        product.refresh_from_db()
        self.assertEqual(product.stock_quantity, 15)
        
        # Vérification du mouvement
        movements = StockMovement.objects.filter(product=product)
        self.assertEqual(movements.count(), 1)
        
        movement = movements.first()
        self.assertEqual(movement.movement_type, 'correction')
        self.assertEqual(movement.quantity, 5)
        self.assertEqual(movement.stock_before, 10)
        self.assertEqual(movement.stock_after, 15)
        self.assertIn("Modification manuelle", movement.note)
