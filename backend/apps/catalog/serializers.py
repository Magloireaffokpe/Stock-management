from decimal import Decimal

from rest_framework import serializers
from .models import Category, Supplier, Product



class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    parent = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "store",
            "store_name",
            "parent",
            "name",
            "slug",
            "description",
            "icon",
            "color",
            "order",
            "is_active",
            "product_count",
        ]
        read_only_fields = ["id", "slug"]

    def validate(self, attrs):
        parent = attrs.get('parent')
        store = attrs.get('store')

        if self.instance:
            if parent is None and 'parent' not in attrs:
                parent = self.instance.parent
            if store is None and 'store' not in attrs:
                store = self.instance.store

        if parent and store:
            if parent.store_id != store.id:
                raise serializers.ValidationError({"parent": "La catégorie parente doit appartenir à la même boutique."})
            
            from django.core.exceptions import ValidationError as DjangoValidationError
            try:
                Category.validate_depth(parent)
            except DjangoValidationError as e:
                raise serializers.ValidationError({"parent": list(e.messages)})
        return attrs


class SupplierSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "phone",
            "whatsapp",
            "email",
            "address",
            "notes",
            "is_active",
            "date_added",
            "product_count",
        ]


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer allégé pour la liste"""

    category_name = serializers.CharField(source="category.name", read_only=True)
    category_color = serializers.CharField(source="category.color", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    stock_status = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(default=True, required=False)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "store",
            "store_name",
            "name",
            "slug",
            "sku",
            "category",
            "category_name",
            "category_color",
            "condition",
            "selling_price",
            "stock_quantity",
            "stock_status",
            "low_stock_threshold",
            "image_url",
            "supplier",
            "supplier_name",
            "is_active",
            "is_featured",
            "date_added",
            "last_updated",
        ]
        read_only_fields = ["id", "slug", "sku", "date_added", "last_updated"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return data

    def validate(self, attrs):
        category = attrs.get('category')
        store = attrs.get('store')

        if self.instance:
            if store and store != self.instance.store:
                raise serializers.ValidationError({"store": "La boutique d'un produit ne peut pas être modifiée après sa création."})
            if category is None and 'category' not in attrs:
                category = self.instance.category
            if store is None and 'store' not in attrs:
                store = self.instance.store
        else:
            if not store:
                raise serializers.ValidationError({"store": "Ce champ est obligatoire."})
            if not category:
                raise serializers.ValidationError({"category": "Ce champ est obligatoire."})

        if category and store:
            if category.store_id != store.id:
                raise serializers.ValidationError({"category": "La catégorie doit appartenir à la même boutique que le produit."})
        return attrs

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ProductDetailSerializer(ProductListSerializer):
    """Serializer complet avec descriptions et specs"""

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ["description", "specifications"]
