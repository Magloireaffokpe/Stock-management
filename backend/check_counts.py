import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.catalog.models import Product, Category, SubCategory
from apps.sales.models import Sale

print(f"Products: {Product.objects.count()}")
print(f"Categories: {Category.objects.count()}")
print(f"SubCategories: {SubCategory.objects.count()}")
print(f"Sales: {Sale.objects.count()}")
