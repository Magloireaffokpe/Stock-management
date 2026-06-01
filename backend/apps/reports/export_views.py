from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .exporters import export_sales_excel, export_products_excel, export_stock_movements_excel


class ExportSalesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.sales.models import Sale
        qs = Sale.objects.select_related('client', 'created_by').all()

        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(sale_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(sale_date__date__lte=date_to)

        response = export_sales_excel(qs)
        if response is None:
            return Response({'error': 'openpyxl non installé'}, status=500)
        return response


class ExportProductsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.catalog.models import Product
        qs = Product.objects.select_related('category', 'supplier').all()

        category_id = request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)

        response = export_products_excel(qs)
        if response is None:
            return Response({'error': 'openpyxl non installé'}, status=500)
        return response


class ExportMovementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.stock.models import StockMovement
        qs = StockMovement.objects.select_related('product', 'created_by').all()

        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        response = export_stock_movements_excel(qs)
        if response is None:
            return Response({'error': 'openpyxl non installé'}, status=500)
        return response
