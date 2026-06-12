from rest_framework import serializers
from .models import StockMovement, StockAlert


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku  = serializers.CharField(source='product.sku', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    movement_type_display = serializers.CharField(source='get_movement_type_display', read_only=True)
    reference_id = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'movement_type', 'movement_type_display',
            'quantity', 'stock_before', 'stock_after',
            'unit_price', 'reference', 'reference_id', 'note',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'stock_before', 'stock_after', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'Système'

    def get_reference_id(self, obj):
        if not obj.reference:
            return None
        if obj.movement_type in ['sale', 'sale_cancel']:
            from apps.sales.models import Sale
            sale = Sale.objects.filter(invoice_number=obj.reference).first()
            return sale.id if sale else None
        elif obj.movement_type == 'restock':
            from apps.sales.models import Restock
            restock = Restock.objects.filter(reference=obj.reference).first()
            return restock.id if restock else None
        return None


class StockAdjustmentSerializer(serializers.Serializer):
    """Pour ajuster manuellement le stock (perte, casse, correction)"""
    product_id    = serializers.IntegerField()
    quantity      = serializers.IntegerField()  # positif = entrée, négatif = sortie
    movement_type = serializers.ChoiceField(choices=['adjustment', 'loss', 'return'])
    note          = serializers.CharField(required=False, allow_blank=True)


class StockAlertSerializer(serializers.ModelSerializer):
    product_name  = serializers.CharField(source='product.name', read_only=True)
    product_sku   = serializers.CharField(source='product.sku', read_only=True)
    product_stock = serializers.IntegerField(source='product.stock_quantity', read_only=True)
    alert_level_display = serializers.CharField(source='get_alert_level_display', read_only=True)

    class Meta:
        model = StockAlert
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'product_stock',
            'alert_level', 'alert_level_display',
            'stock_at_alert', 'is_read', 'is_resolved', 'created_at',
        ]
