from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .filters import ProductFilter
from .models import Category, Supplier, Product
from .serializers import (
    CategorySerializer,
    SupplierSerializer,
    ProductListSerializer,
    ProductDetailSerializer,
)


class IsAdminOrReadOnly(IsAuthenticated):
    """Admin/superuser = écriture ; tout le monde connecté = lecture"""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return (
            request.user.is_staff
            or request.user.is_superuser
            or getattr(request.user, "role", "") == "admin"
        )


# ── CATEGORIES ──────────────────────────────────────────────────


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name"]
    ordering_fields = ["order", "name"]

    def get_queryset(self):
        from django.db.models import Count, Q

        qs = Category.objects.prefetch_related("children").annotate(
            product_count=Count("products", filter=Q(products__is_active=True))
        ).order_by("order", "name")
        store_id = self.request.query_params.get("store")
        if store_id:
            qs = qs.filter(store_id=store_id)
        if self.request.query_params.get("active_only"):
            qs = qs.filter(is_active=True)
        return qs


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Category.objects.prefetch_related("children").all()

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as e:
            return Response(
                {"error": "Cette catégorie ne peut pas être supprimée car elle contient des sous-catégories ou des produits."},
                status=status.HTTP_400_BAD_REQUEST
            )


# ── SOUS-CATÉGORIES ──────────────────────────────────────────────


class CategoryTreeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store_id = request.query_params.get("store")
        if not store_id:
            return Response(
                {"error": "Le paramètre 'store' est requis."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.db.models import Count, Q

        categories = list(
            Category.objects.filter(store_id=store_id)
            .annotate(
                product_count=Count("products", filter=Q(products__is_active=True))
            )
            .order_by("order", "name")
        )

        nodes = {
            c.id: {
                "id": c.id,
                "store": c.store_id,
                "store_name": c.store.name,
                "parent": c.parent_id,
                "name": c.name,
                "slug": c.slug,
                "description": c.description,
                "icon": c.icon,
                "color": c.color,
                "order": c.order,
                "is_active": c.is_active,
                "product_count": c.product_count,
                "children": []
            }
            for c in categories
        }
        
        root_nodes = []
        for c in categories:
            node = nodes[c.id]
            if c.parent_id:
                parent_node = nodes.get(c.parent_id)
                if parent_node:
                    parent_node["children"].append(node)
                else:
                    root_nodes.append(node)
            else:
                root_nodes.append(node)
                
        return Response(root_nodes, status=status.HTTP_200_OK)





# ── FOURNISSEURS ─────────────────────────────────────────────────


class SupplierListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name", "phone", "email"]
    ordering_fields = ["name", "date_added"]

    def get_queryset(self):
        from django.db.models import Count, Q

        qs = Supplier.objects.annotate(
            product_count=Count("products", filter=Q(products__is_active=True))
        )
        if self.request.query_params.get("active_only"):
            qs = qs.filter(is_active=True)
        return qs


class SupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Supplier.objects.all()


# ── PRODUITS ─────────────────────────────────────────────────────


class ProductListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrReadOnly]
    filterset_class = ProductFilter
    search_fields = ["name", "sku", "description"]
    ordering_fields = [
        "name",
        "selling_price",
        "stock_quantity",
        "date_added",
        "last_updated",
    ]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        return (
            ProductDetailSerializer
            if self.request.method == "POST"
            else ProductListSerializer
        )

    def get_queryset(self):
        return Product.objects.select_related(
            "category", "supplier"
        ).all()

    def perform_create(self, serializer):
        product = serializer.save()
        from apps.settings_app.utils import log_audit_action

        log_audit_action(
            self.request, "create", f"Création du produit « {product.name} »"
        )
        # Enregistrer le stock initial comme mouvement
        if product.stock_quantity > 0:
            from apps.stock.models import StockMovement

            StockMovement.objects.create(
                product=product,
                movement_type="initial",
                quantity=product.stock_quantity,
                stock_before=0,
                stock_after=product.stock_quantity,
                note="Stock initial à la création du produit",
                created_by=self.request.user,
            )


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = ProductDetailSerializer

    def get_queryset(self):
        return Product.objects.select_related(
            "category", "supplier"
        ).all()

    def perform_update(self, serializer):
        from django.db import transaction

        with transaction.atomic():
            instance = self.get_object()
            old_stock = instance.stock_quantity
            product = serializer.save()

            from apps.settings_app.utils import log_audit_action

            log_audit_action(
                self.request, "update", f"Modification du produit « {product.name} »"
            )

            if product.stock_quantity != old_stock:
                from apps.stock.models import StockMovement

                StockMovement.objects.create(
                    product=product,
                    movement_type="correction",
                    quantity=product.stock_quantity - old_stock,
                    stock_before=old_stock,
                    stock_after=product.stock_quantity,
                    note="Modification manuelle via formulaire produit",
                    created_by=self.request.user,
                )

    def destroy(self, request, *args, **kwargs):
        """Supprime le produit s'il n'est pas lié à des réapprovisionnements ou devis."""
        instance = self.get_object()
        product_name = instance.name

        from django.db import transaction
        from django.db.models import ProtectedError
        from apps.stock.models import StockMovement, StockAlert
        from apps.settings_app.utils import log_audit_action

        try:
            with transaction.atomic():
                # Supprimer explicitement les logs opérationnels
                StockMovement.objects.filter(product=instance).delete()
                StockAlert.objects.filter(product=instance).delete()
                # Tenter de supprimer le produit (lèvera ProtectedError si lié à RestockItem/QuotationItem)
                instance.delete()
        except ProtectedError:
            return Response(
                {"error": "Ce produit ne peut pas être supprimé car il est lié à des réapprovisionnements ou devis existants."},
                status=status.HTTP_400_BAD_REQUEST
            )

        log_audit_action(
            request, "delete", f"Suppression définitive du produit « {product_name} »"
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductLowStockView(generics.ListAPIView):
    """Retourne uniquement les produits en stock faible/critique/rupture"""

    serializer_class = ProductListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from apps.settings_app.models import StoreSettings

        store = StoreSettings.get()
        return (
            Product.objects.filter(
                is_active=True, stock_quantity__lte=store.low_stock_threshold
            )
            .select_related("category", "supplier")
            .order_by("stock_quantity")
        )


class ProductSearchView(generics.ListAPIView):
    """Recherche rapide produits pour le POS / panier"""

    serializer_class = ProductListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q

        q = self.request.query_params.get("q", "")
        if not q:
            return Product.objects.none()
        qs = Product.objects.filter(
            is_active=True,
            stock_quantity__gt=0,
        ).filter(Q(name__icontains=q) | Q(sku__icontains=q))
        store_id = self.request.query_params.get("store")
        if store_id:
            qs = qs.filter(store_id=store_id)
        return qs.select_related("category", "supplier")[:20]
