from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status


class IsAdminOnly(IsAuthenticated):
    """Admin-only access for exports and sensitive reports."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return (
            request.user.is_staff
            or request.user.is_superuser
            or getattr(request.user, "role", "") == "admin"
        )


from .exporters import (
    export_sales_excel,
    export_products_excel,
    export_stock_movements_excel,
)


def _store_label(store_id):
    if not store_id:
        return None
    from apps.stores.models import Store
    store = Store.objects.filter(id=store_id).first()
    return store.name if store else None


class ExportSalesView(APIView):
    permission_classes = [IsAdminOnly]

    def get(self, request):
        from apps.sales.models import Sale

        qs = Sale.objects.select_related("client", "created_by").prefetch_related("items").all()

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(sale_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(sale_date__date__lte=date_to)

        store_id = request.query_params.get("store")
        if store_id:
            qs = qs.filter(items__product__store_id=store_id).distinct()

        response = export_sales_excel(qs, store_label=_store_label(store_id))
        if response is None:
            return Response({"error": "openpyxl non installé"}, status=500)
        return response


class ExportProductsView(APIView):
    permission_classes = [IsAdminOnly]

    def get(self, request):
        from apps.catalog.models import Product

        qs = Product.objects.select_related("category", "supplier", "store").all()

        store_id = request.query_params.get("store")
        if store_id:
            qs = qs.filter(store_id=store_id)

        category_id = request.query_params.get("category")
        if category_id:
            qs = qs.filter(category_id=category_id)

        response = export_products_excel(qs, store_id=store_id, store_label=_store_label(store_id))
        if response is None:
            return Response({"error": "openpyxl non installé"}, status=500)
        return response


class ExportMovementsView(APIView):
    permission_classes = [IsAdminOnly]

    def get(self, request):
        from apps.stock.models import StockMovement

        qs = StockMovement.objects.select_related("product", "created_by").all()

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        store_id = request.query_params.get("store")
        if store_id:
            qs = qs.filter(product__store_id=store_id)

        response = export_stock_movements_excel(qs, store_label=_store_label(store_id))
        if response is None:
            return Response({"error": "openpyxl non installé"}, status=500)
        return response
