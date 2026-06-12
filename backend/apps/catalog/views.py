from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .filters import ProductFilter
from .models import Category, SubCategory, Supplier, Product
from .serializers import (
    CategorySerializer, SubCategorySerializer,
    SupplierSerializer, ProductListSerializer, ProductDetailSerializer,
)


class IsAdminOrReadOnly(IsAuthenticated):
    """Admin/superuser = écriture ; tout le monde connecté = lecture"""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return (
            request.user.is_staff
            or request.user.is_superuser
            or getattr(request.user, 'role', '') == 'admin'
        )


# ── CATEGORIES ──────────────────────────────────────────────────

class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['name']
    ordering_fields = ['order', 'name']

    def get_queryset(self):
        from django.db.models import Count, Q
        qs = Category.objects.prefetch_related('subcategories').annotate(
            product_count=Count('products', filter=Q(products__is_active=True))
        )
        if self.request.query_params.get('active_only'):
            qs = qs.filter(is_active=True)
        return qs


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Category.objects.prefetch_related('subcategories').all()


# ── SOUS-CATÉGORIES ──────────────────────────────────────────────

class SubCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = SubCategorySerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = SubCategory.objects.all()
        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs


class SubCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubCategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = SubCategory.objects.all()


# ── FOURNISSEURS ─────────────────────────────────────────────────

class SupplierListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['name', 'phone', 'email']
    ordering_fields = ['name', 'date_added']

    def get_queryset(self):
        from django.db.models import Count, Q
        qs = Supplier.objects.annotate(
            product_count=Count('products', filter=Q(products__is_active=True))
        )
        if self.request.query_params.get('active_only'):
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
    search_fields = ['name', 'sku', 'description']
    ordering_fields = ['name', 'selling_price', 'stock_quantity', 'date_added', 'last_updated']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        return ProductDetailSerializer if self.request.method == 'POST' else ProductListSerializer

    def get_queryset(self):
        return Product.objects.select_related('category', 'subcategory', 'supplier').all()

    def perform_create(self, serializer):
        product = serializer.save()
        from apps.settings_app.utils import log_audit_action
        log_audit_action(self.request, 'create', f"Création du produit « {product.name} »")
        # Enregistrer le stock initial comme mouvement
        if product.stock_quantity > 0:
            from apps.stock.models import StockMovement
            StockMovement.objects.create(
                product=product,
                movement_type='initial',
                quantity=product.stock_quantity,
                stock_before=0,
                stock_after=product.stock_quantity,
                note='Stock initial à la création du produit',
                created_by=self.request.user,
            )


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = ProductDetailSerializer

    def get_queryset(self):
        return Product.objects.select_related('category', 'subcategory', 'supplier').all()

    def perform_update(self, serializer):
        from django.db import transaction
        with transaction.atomic():
            instance = self.get_object()
            old_stock = instance.stock_quantity
            product = serializer.save()
            
            from apps.settings_app.utils import log_audit_action
            log_audit_action(self.request, 'update', f"Modification du produit « {product.name} »")
            
            if product.stock_quantity != old_stock:
                from apps.stock.models import StockMovement
                StockMovement.objects.create(
                    product=product,
                    movement_type='correction',
                    quantity=product.stock_quantity - old_stock,
                    stock_before=old_stock,
                    stock_after=product.stock_quantity,
                    note='Modification manuelle via formulaire produit',
                    created_by=self.request.user,
                )

    def destroy(self, request, *args, **kwargs):
        """Soft delete — désactiver plutôt que supprimer"""
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        
        from apps.settings_app.utils import log_audit_action
        log_audit_action(request, 'delete', f"Désactivation (suppression) du produit « {instance.name} »")
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductLowStockView(generics.ListAPIView):
    """Retourne uniquement les produits en stock faible/critique/rupture"""
    serializer_class = ProductListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from apps.settings_app.models import StoreSettings
        store = StoreSettings.get()
        return Product.objects.filter(
            is_active=True,
            stock_quantity__lte=store.low_stock_threshold
        ).select_related('category', 'supplier').order_by('stock_quantity')


class ProductSearchView(generics.ListAPIView):
    """Recherche rapide produits pour le POS / panier"""
    serializer_class = ProductListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        q = self.request.query_params.get('q', '')
        if len(q) < 1:
            return Product.objects.none()
        return Product.objects.filter(
            is_active=True,
            stock_quantity__gt=0,
        ).filter(
            models.Q(name__icontains=q) |
            models.Q(sku__icontains=q)
        ).select_related('category')[:20]


# Besoin du modèle Q dans les vues
from django.db import models as django_models

class ProductSearchView(generics.ListAPIView):
    """Recherche rapide produits pour le POS"""
    serializer_class = ProductListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        q = self.request.query_params.get('q', '')
        if not q:
            return Product.objects.none()
        return Product.objects.filter(
            is_active=True
        ).filter(
            Q(name__icontains=q) | Q(sku__icontains=q)
        ).select_related('category', 'supplier')[:20]
