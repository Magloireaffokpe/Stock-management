from django.contrib import admin
from .models import Category, SubCategory, Supplier, Product

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ['name', 'slug', 'icon', 'order', 'is_active', 'product_count']
    list_editable = ['order', 'is_active']
    prepopulated_fields = {'slug': ('name',)}

@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'order']
    list_filter  = ['category']

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display  = ['name', 'phone', 'email', 'is_active']
    list_filter   = ['is_active']
    search_fields = ['name', 'email', 'phone']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display   = ['name', 'sku', 'category', 'selling_price', 'stock_quantity', 'is_active', 'is_featured']
    list_filter    = ['category', 'condition', 'is_active', 'is_featured']
    search_fields  = ['name', 'sku']
    list_editable  = ['is_active', 'is_featured']
    readonly_fields = ['slug', 'sku', 'date_added', 'last_updated']
