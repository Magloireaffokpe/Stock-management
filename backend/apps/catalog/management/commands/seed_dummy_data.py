import random
from datetime import timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.stores.models import Store
from apps.catalog.models import Category, Product, Supplier
from apps.sales.models import Client, Sale, SaleItem, generate_invoice_number
from apps.stock.models import StockMovement

from apps.settings_app.models import StoreSettings

User = get_user_model()

class Command(BaseCommand):
    help = 'Remplir la base de données avec des données fictives pour les tests'

    def handle(self, *args, **kwargs):
        self.stdout.write("Génération des données fictives en cours...")
        
        # S'assurer que les StoreSettings existent
        StoreSettings.get()

        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            self.stdout.write(self.style.ERROR("Aucun utilisateur admin trouvé. Lancez python manage.py setup_admin d'abord."))
            return

        # 1. Boutiques
        store1, _ = Store.objects.get_or_create(name="Boutique Principale", defaults={"slug": "boutique-principale"})
        store2, _ = Store.objects.get_or_create(name="Boutique Annexe", defaults={"slug": "boutique-annexe"})
        self.stdout.write("✓ Boutiques créées")

        # 2. Fournisseurs
        sup1, _ = Supplier.objects.get_or_create(name="Tech Data Corp", phone="+33 1 23 45 67 89")
        sup2, _ = Supplier.objects.get_or_create(name="Ingram Micro", phone="+33 1 98 76 54 32")
        self.stdout.write("✓ Fournisseurs créés")

        # 3. Catégories
        cat_tel_s1, _ = Category.objects.get_or_create(store=store1, name="Téléphones", icon="smartphone", color="#3b82f6")
        cat_pc_s1, _  = Category.objects.get_or_create(store=store1, name="Ordinateurs", icon="laptop", color="#10b981")
        cat_acc_s2, _ = Category.objects.get_or_create(store=store2, name="Accessoires", icon="headphones", color="#8b5cf6")
        self.stdout.write("✓ Catégories créées")

        # 4. Produits
        products_data = [
            (store1, cat_tel_s1, sup1, "iPhone 15 Pro", 1200000, 15, "new"),
            (store1, cat_tel_s1, sup1, "Samsung Galaxy S24", 950000, 10, "new"),
            (store1, cat_pc_s1, sup2, "MacBook Air M3", 1500000, 5, "new"),
            (store1, cat_pc_s1, sup2, "Dell XPS 13", 1300000, 8, "new"),
            (store2, cat_acc_s2, sup1, "AirPods Pro", 250000, 20, "new"),
            (store2, cat_acc_s2, sup2, "Chargeur Rapide 65W", 35000, 50, "new"),
            (store2, cat_acc_s2, None, "Coque iPhone 15", 15000, 100, "new"),
        ]

        products = []
        for s, c, sup, name, price, stock, cond in products_data:
            p, created = Product.objects.get_or_create(
                store=s,
                name=name,
                defaults={
                    "category": c,
                    "supplier": sup,
                    "selling_price": price,
                    "stock_quantity": stock,
                    "condition": cond,
                    "low_stock_threshold": 5
                }
            )
            if created:
                StockMovement.objects.create(
                    product=p,
                    movement_type="initial",
                    quantity=stock,
                    stock_before=0,
                    stock_after=stock,
                    reference="Initial",
                    created_by=admin_user
                )
            products.append(p)
        self.stdout.write("✓ Produits et stocks initiaux créés")

        # 5. Clients
        client1, _ = Client.objects.get_or_create(first_name="Jean", last_name="Dupont", phone="0102030405")
        client2, _ = Client.objects.get_or_create(first_name="Marie", last_name="Curie", phone="0607080910")
        clients = [client1, client2, None]  # None for anonymous
        self.stdout.write("✓ Clients créés")

        # 6. Ventes
        now = timezone.now()
        for i in range(25):  # Créer 25 ventes aléatoires sur les 30 derniers jours
            sale_date = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            client = random.choice(clients)
            
            # Choisir 1 à 3 produits aléatoires
            sale_products = random.sample(products, random.randint(1, 3))
            
            subtotal = 0
            items = []
            for p in sale_products:
                qty = random.randint(1, 3)
                if p.stock_quantity >= qty:
                    price = p.selling_price
                    subtotal += price * qty
                    items.append((p, qty, price))
            
            if not items:
                continue

            total_amount = subtotal

            sale = Sale.objects.create(
                invoice_number=generate_invoice_number(),
                client=client,
                subtotal=subtotal,
                total_amount=total_amount,
                amount_paid=total_amount,
                payment_method=random.choice(["cash", "mtn", "moov", "card"]),
                created_by=admin_user
            )
            sale.sale_date = sale_date  # Overwrite auto_now_add if any
            sale.save()

            for p, qty, price in items:
                SaleItem.objects.create(
                    sale=sale,
                    product=p,
                    product_name=p.name,
                    quantity=qty,
                    unit_price=price,
                    subtotal=price * qty
                )
                
                # Mouvement de stock
                stock_before = p.stock_quantity
                p.stock_quantity -= qty
                p.save()
                
                StockMovement.objects.create(
                    product=p,
                    movement_type="sale",
                    quantity=-qty,
                    stock_before=stock_before,
                    stock_after=p.stock_quantity,
                    reference=sale.invoice_number,
                    created_by=admin_user,
                )
                # Correct stock movement date for charts
                sm = StockMovement.objects.filter(reference=sale.invoice_number).last()
                if sm:
                    sm.created_at = sale_date
                    sm.save()

        self.stdout.write(self.style.SUCCESS("✓ Ventes et mouvements de stock générés"))
        self.stdout.write(self.style.SUCCESS("\n🎉 Base de données remplie avec succès !"))
