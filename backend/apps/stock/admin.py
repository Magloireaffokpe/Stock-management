from django.contrib import admin
from .models import StockMovement, StockAlert

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display  = ['product', 'movement_type', 'quantity', 'stock_before', 'stock_after', 'reference', 'created_at']
    list_filter   = ['movement_type', 'created_at']
    search_fields = ['product__name', 'reference']
    readonly_fields = ['created_at']

@admin.register(StockAlert)
class StockAlertAdmin(admin.ModelAdmin):
    list_display = ['product', 'alert_level', 'stock_at_alert', 'is_read', 'is_resolved', 'created_at']
    list_filter  = ['alert_level', 'is_read', 'is_resolved']
