"""
Commande : python manage.py init_stock
Crée les mouvements de stock initiaux (type 'initial') pour tous les produits
qui ont un stock > 0 mais pas encore de mouvement enregistré.
"""
from django.core.management.base import BaseCommand
from apps.catalog.models import Product
from apps.stock.models import StockMovement


class Command(BaseCommand):
    help = "Initialise les mouvements de stock pour les produits existants"

    def handle(self, *args, **options):
        products = Product.objects.filter(is_active=True, stock_quantity__gt=0)
        created = 0

        for product in products:
            already_has_initial = StockMovement.objects.filter(
                product=product, movement_type='initial'
            ).exists()

            if not already_has_initial:
                StockMovement.objects.create(
                    product=product,
                    movement_type='initial',
                    quantity=product.stock_quantity,
                    stock_before=0,
                    stock_after=product.stock_quantity,
                    note='Stock initial chargé via init_stock',
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f'✅ {created} mouvement(s) initial/initiaux créé(s).'
        ))
