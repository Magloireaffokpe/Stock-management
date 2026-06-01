from django.contrib import admin
from .models import StoreSettings

@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    list_display = ['store_name', 'city', 'currency', 'low_stock_threshold']
    fieldsets = (
        ('Identité', {'fields': ('store_name', 'tagline', 'logo')}),
        ('Contact', {'fields': ('phone', 'whatsapp', 'email', 'address', 'city')}),
        ('Devise', {'fields': ('currency', 'currency_symbol')}),
        ('Thème', {'fields': ('color_primary', 'color_accent', 'color_success')}),
        ('Alertes', {'fields': ('low_stock_threshold', 'critical_stock_threshold', 'sound_enabled')}),
        ('Facturation', {'fields': ('invoice_prefix', 'invoice_counter', 'tax_rate', 'footer_invoice_text')}),
    )
