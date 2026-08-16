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


# ── BOUTIQUES ────────────────────────────────────────────────────

def make_store(name=None, slug=None, is_active=True, order=0):
    from apps.stores.models import Store
    if name is None:
        uid = _uid()
        name = f'Store-{uid}'
        if slug is None:
            slug = f'store-{uid}'
    elif slug is None:
        from django.utils.text import slugify
        slug = slugify(name)
    return Store.objects.create(
        name=name,
        slug=slug,
        is_active=is_active,
        order=order,
    )


# ── CATALOGUE ────────────────────────────────────────────────────

def make_category(name=None, color='#2563EB', order=1, store=None, parent=None):
    from apps.catalog.models import Category
    from apps.stores.models import Store
    if store is None:
        store, _ = Store.objects.get_or_create(slug='default', defaults={'name': 'Boutique par défaut'})
    if name is None:
        name = f'Cat-{_uid()}'
    return Category.objects.create(
        store=store,
        parent=parent,
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
    store=None,
    selling_price=15000,
    stock_quantity=20,
    low_stock_threshold=5,
    condition='new',
    is_active=True,
    **kwargs,
):
    from apps.catalog.models import Product
    from apps.stores.models import Store
    if name is None:
        name = f'Produit-{_uid()}'
    if category is None:
        category = make_category(store=store)
    if store is None:
        store = category.store
    selling_price_val = Decimal(selling_price) if selling_price is not None else None
    return Product.objects.create(
        store=store,
        name=name,
        category=category,
        supplier=supplier,
        selling_price=selling_price_val,
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

def make_sale(user, client=None, items=None, payment_method='cash'):
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

    sale = Sale.objects.create(
        client=client,
        subtotal=subtotal,
        tax_amount=Decimal('0'),
        total_amount=subtotal,
        payment_method=payment_method,
        amount_paid=subtotal,
        change_given=Decimal('0'),
        created_by=user,
    )
    for item in items:
        product = item['product']
        qty     = item['quantity']
        price   = Decimal(str(item['unit_price'])) if item.get('unit_price') is not None else Decimal('0')
        SaleItem.objects.create(
            sale=sale,
            product=product,
            product_name=product.name if product else item.get('product_name', 'Produit Supprimé'),
            quantity=qty,
            unit_price=price,
            subtotal=price * qty,
        )
    return sale


# ── RÉAPPRO ──────────────────────────────────────────────────────

def make_restock(user, product, quantity=10, **kwargs):
    from apps.sales.models import Restock, RestockItem
    restock = Restock.objects.create(created_by=user)
    RestockItem.objects.create(
        restock=restock,
        product=product,
        quantity=quantity,
    )
    return restock
