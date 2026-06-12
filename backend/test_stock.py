import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.catalog.models import Product, Category

# Ensure some test data
cat, _ = Category.objects.get_or_create(name='Test Cat')
p1, _ = Product.objects.get_or_create(name='Product 1', sku='sku1', category=cat, stock_quantity=5, selling_price=100, purchase_price=50, is_active=True)
p2, _ = Product.objects.get_or_create(name='Product 2', sku='sku2', category=cat, stock_quantity=0, selling_price=100, purchase_price=50, is_active=True)
p3, _ = Product.objects.get_or_create(name='Product 3', sku='sku3', category=cat, stock_quantity=-2, selling_price=100, purchase_price=50, is_active=True)
p4, _ = Product.objects.get_or_create(name='Product 4', sku='sku4', category=cat, stock_quantity=10, selling_price=100, purchase_price=50, is_active=False)

from apps.catalog.filters import ProductFilter

qs = Product.objects.all()
f = ProductFilter({'min_stock': 1, 'is_active': True}, queryset=qs)
filtered = f.qs

print("Products in stock and active:")
for p in filtered:
    print(f"- {p.name} (stock: {p.stock_quantity}, active: {p.is_active})")
