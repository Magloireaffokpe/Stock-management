from django.contrib import admin
from .models import Client, Sale, SaleItem, Quotation, Restock, RestockItem

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display  = ['full_name', 'phone', 'total_purchases', 'date_added']
    search_fields = ['first_name', 'last_name', 'phone']

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ['product_name', 'subtotal']

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display  = ['invoice_number', 'client', 'total_amount', 'payment_method', 'is_cancelled', 'created_at']
    list_filter   = ['payment_method', 'is_cancelled', 'sale_date']
    search_fields = ['invoice_number', 'client__first_name', 'client__last_name']
    readonly_fields = ['invoice_number', 'created_at']
    inlines = [SaleItemInline]

class RestockItemInline(admin.TabularInline):
    model = RestockItem
    extra = 0

@admin.register(Restock)
class RestockAdmin(admin.ModelAdmin):
    list_display = ['reference', 'supplier', 'restock_date', 'created_at']
    inlines      = [RestockItemInline]
