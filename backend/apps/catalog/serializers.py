from decimal import Decimal

from rest_framework import serializers
from .models import Category, SubCategory, Supplier, Product


class SubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCategory
        fields = ["id", "category", "name", "slug", "order"]


class CategorySerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "icon",
            "color",
            "order",
            "is_active",
            "subcategories",
            "product_count",
        ]
        read_only_fields = ["id", "slug"]


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
    stock_status = serializers.CharField(read_only=True)
    purchase_price = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    margin = serializers.DecimalField(max_digits=12, decimal_places=0, read_only=True)
    margin_percent = serializers.FloatField(read_only=True)
    is_active = serializers.BooleanField(default=True, required=False)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "sku",
            "category",
            "category_name",
            "category_color",
            "subcategory",
            "condition",
            "purchase_price",
            "selling_price",
            "stock_quantity",
            "stock_status",
            "low_stock_threshold",
            "margin",
            "margin_percent",
            "image_url",
            "supplier",
            "supplier_name",
            "is_active",
            "is_featured",
            "date_added",
            "last_updated",
        ]
        read_only_fields = ["id", "slug", "sku", "date_added", "last_updated"]

    def _can_view_sensitive_fields(self, request=None):
        if not request:
            return True
        user = getattr(request, "user", None)
        return bool(
            getattr(user, "is_staff", False)
            or getattr(user, "is_superuser", False)
            or getattr(user, "role", "") == "admin"
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if not self._can_view_sensitive_fields(request):
            data.pop("purchase_price", None)
            data.pop("margin", None)
            data.pop("margin_percent", None)
        return data

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ProductDetailSerializer(ProductListSerializer):
    """Serializer complet avec descriptions et specs"""

    # ProductListSerializer masks this field for employees and declares it
    # read-only. Product creation/update is admin-only, so it must be writable
    # here and validated before reaching the database.
    purchase_price = serializers.DecimalField(
        max_digits=12, decimal_places=0, min_value=Decimal("0")
    )

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ["description", "specifications"]
