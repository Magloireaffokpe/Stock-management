from rest_framework import serializers
from .models import Client, Sale, SaleItem, Quotation, QuotationItem, Restock, RestockItem


class ClientSerializer(serializers.ModelSerializer):
    full_name       = serializers.CharField(read_only=True)
    total_purchases = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    purchases_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'first_name', 'last_name', 'full_name',
                  'phone', 'whatsapp', 'address', 'notes',
                  'total_purchases', 'purchases_count', 'date_added']


# ── VENTES ────────────────────────────────────────────────────────

class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_name', 'quantity',
                  'unit_price', 'purchase_price', 'subtotal']
        read_only_fields = ['product_name', 'purchase_price', 'subtotal']


class SaleItemWriteSerializer(serializers.Serializer):
    """Pour créer une vente — items simplifiés"""
    product_id  = serializers.IntegerField()
    quantity    = serializers.IntegerField(min_value=1)
    unit_price  = serializers.DecimalField(max_digits=12, decimal_places=0)


class SaleCreateSerializer(serializers.Serializer):
    """Crée une vente complète en une seule requête"""
    client_id      = serializers.IntegerField(required=False, allow_null=True)
    items          = SaleItemWriteSerializer(many=True, min_length=1)
    payment_method = serializers.ChoiceField(choices=Sale.PAYMENT_METHODS, default='cash')
    amount_paid    = serializers.DecimalField(max_digits=14, decimal_places=0)
    discount       = serializers.DecimalField(max_digits=14, decimal_places=0, default=0)
    notes          = serializers.CharField(required=False, allow_blank=True, default='')


class SaleSerializer(serializers.ModelSerializer):
    items          = SaleItemSerializer(many=True, read_only=True)
    client_name    = serializers.CharField(source='client.full_name', read_only=True, default='Client comptoir')
    created_by_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    total_margin   = serializers.DecimalField(max_digits=14, decimal_places=0, read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'invoice_number', 'client', 'client_name',
            'sale_date', 'subtotal', 'discount', 'tax_amount', 'total_amount',
            'payment_method', 'payment_method_display',
            'amount_paid', 'change_given', 'notes',
            'is_cancelled', 'cancelled_at', 'cancelled_by', 'cancelled_by_name',
            'created_by', 'created_by_name', 'created_at',
            'total_margin', 'items', 'pdf_file',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''

    def get_cancelled_by_name(self, obj):
        if obj.cancelled_by:
            return obj.cancelled_by.get_full_name() or obj.cancelled_by.username
        return ''


class SaleListSerializer(serializers.ModelSerializer):
    """Version allégée pour la liste (sans items détaillés)"""
    client_name    = serializers.CharField(source='client.full_name', read_only=True, default='Client comptoir')
    created_by_name = serializers.SerializerMethodField()
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'invoice_number', 'client', 'client_name',
            'sale_date', 'total_amount', 'payment_method', 'payment_method_display',
            'amount_paid', 'change_given', 'is_cancelled',
            'created_by', 'created_by_name', 'created_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''


# ── DEVIS ──────────────────────────────────────────────────────────

class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = ['id', 'product', 'quantity', 'unit_price', 'subtotal']


class QuotationSerializer(serializers.ModelSerializer):
    items        = QuotationItemSerializer(many=True, read_only=True)
    client_name  = serializers.CharField(source='client.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Quotation
        fields = [
            'id', 'quotation_number', 'client', 'client_name',
            'status', 'status_display', 'valid_until', 'total_amount',
            'notes', 'converted_to_sale', 'created_by', 'created_at',
            'items',
        ]


# ── RÉAPPROS ──────────────────────────────────────────────────────

class RestockItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = RestockItem
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_cost']


class RestockItemWriteSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity   = serializers.IntegerField(min_value=1)
    unit_cost  = serializers.DecimalField(max_digits=12, decimal_places=0)


class RestockCreateSerializer(serializers.Serializer):
    supplier_id  = serializers.IntegerField(required=False, allow_null=True)
    restock_date = serializers.DateField(required=False)
    notes        = serializers.CharField(required=False, allow_blank=True, default='')
    items        = RestockItemWriteSerializer(many=True, min_length=1)


class RestockSerializer(serializers.ModelSerializer):
    items         = RestockItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Restock
        fields = [
            'id', 'reference', 'supplier', 'supplier_name',
            'restock_date', 'total_cost', 'notes',
            'created_by', 'created_by_name', 'created_at',
            'items',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''
