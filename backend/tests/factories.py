"""
Factories de données de test.
Centralise la création d'objets réutilisables dans tous les tests.
Pas de dépendance externe (factory_boy) — pur Django TestCase.
"""
import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model

User = get_user_model()


def _uid():
    """Suffixe court unique pour éviter les collisions de slug/sku/username."""
    return uuid.uuid4().hex[:8]


# ── UTILISATEURS ─────────────────────────────────────────────────

def make_admin(username='admin_test', password='testpass123'):
    return User.objects.create_superuser(
        username=username,
        password=password,
        email=f'{username}@test.bj',
        first_name='Admin',
        last_name='Test',
        role='admin',
        is_staff=True,
    )


def make_employee(username='employee_test', password='testpass123'):
    return User.objects.create_user(
        username=username,
        password=password,
        email=f'{username}@test.bj',
        first_name='Employé',
        last_name='Test',
        role='employee',
    )


# ── CATALOGUE ────────────────────────────────────────────────────

def make_category(name=None, color='#2563EB', order=1):
    from apps.catalog.models import Category
    if name is None:
        name = f'Cat-{_uid()}'
    return Category.objects.create(
        name=name,
        color=color,
        icon='laptop',
        order=order,
        is_active=True,
    )


def make_supplier(name=None):
    from apps.catalog.models import Supplier
    if name is None:
        name = f'Fournisseur-{_uid()}'
    return Supplier.objects.create(
        name=name,
        phone='+229 97 00 00 00',
        is_active=True,
    )


def make_product(
    name=None,
    category=None,
    supplier=None,
    purchase_price=10000,
    selling_price=15000,
    stock_quantity=20,
    low_stock_threshold=5,
    condition='new',
    is_active=True,
):
    from apps.catalog.models import Product
    if name is None:
        name = f'Produit-{_uid()}'
    if category is None:
        category = make_category()
    return Product.objects.create(
        name=name,
        category=category,
        supplier=supplier,
        purchase_price=Decimal(purchase_price),
        selling_price=Decimal(selling_price),
        stock_quantity=stock_quantity,
        low_stock_threshold=low_stock_threshold,
        condition=condition,
        is_active=is_active,
    )


# ── PARAMÈTRES ───────────────────────────────────────────────────

def make_settings(low_stock=5, critical_stock=2):
    from apps.settings_app.models import StoreSettings
    s = StoreSettings.get()
    s.low_stock_threshold = low_stock
    s.critical_stock_threshold = critical_stock
    s.invoice_prefix = 'TEST'
    s.invoice_counter = 1
    s.quotation_prefix = 'DEV'
    s.quotation_counter = 1
    s.restock_prefix = 'REAP'
    s.restock_counter = 1
    s.tax_rate = Decimal('0')
    s.save()
    return s


# ── CLIENTS ──────────────────────────────────────────────────────

def make_client(first_name='Jean', last_name='Dupont', phone='+229 97 11 22 33'):
    from apps.sales.models import Client
    return Client.objects.create(
        first_name=first_name,
        last_name=last_name,
        phone=phone,
    )


# ── VENTES ───────────────────────────────────────────────────────

def make_sale(user, client=None, items=None, payment_method='cash', discount=0):
    """
    Crée une vente AVEC ses SaleItems (les signals gèrent le stock).
    items = [{'product': p, 'quantity': 2, 'unit_price': 15000}, ...]
    """
    from apps.sales.models import Sale, SaleItem
    from decimal import Decimal

    if items is None:
        product = make_product()
        items = [{'product': product, 'quantity': 1, 'unit_price': product.selling_price}]

    subtotal = sum(Decimal(str(i['unit_price'])) * i['quantity'] for i in items)
    discount  = Decimal(str(discount))
    total     = subtotal - discount

    sale = Sale.objects.create(
        client=client,
        subtotal=subtotal,
        discount=discount,
        tax_amount=Decimal('0'),
        total_amount=total,
        payment_method=payment_method,
        amount_paid=total,
        change_given=Decimal('0'),
        created_by=user,
    )
    for item in items:
        product = item['product']
        qty     = item['quantity']
        price   = Decimal(str(item['unit_price']))
        SaleItem.objects.create(
            sale=sale,
            product=product,
            product_name=product.name,
            quantity=qty,
            unit_price=price,
            purchase_price=product.purchase_price,
            subtotal=price * qty,
        )
    return sale


# ── RÉAPPRO ──────────────────────────────────────────────────────

def make_restock(user, product, quantity=10, unit_cost=8000):
    from apps.sales.models import Restock, RestockItem
    restock = Restock.objects.create(created_by=user)
    RestockItem.objects.create(
        restock=restock,
        product=product,
        quantity=quantity,
        unit_cost=Decimal(str(unit_cost)),
    )
    return restock
