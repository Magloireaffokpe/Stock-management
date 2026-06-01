from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from .models import StockMovement, StockAlert
from .serializers import StockMovementSerializer, StockAdjustmentSerializer, StockAlertSerializer
from .utils import check_and_create_alert, notify_stock_update, notify_stock_alert


# ── MOUVEMENTS DE STOCK ──────────────────────────────────────────

class StockMovementListView(generics.ListAPIView):
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['product', 'movement_type', 'created_by']
    search_fields = ['product__name', 'reference', 'note']
    ordering_fields = ['created_at', 'quantity']

    def get_queryset(self):
        qs = StockMovement.objects.select_related('product', 'created_by').all()

        # Filtre date
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs


class ProductMovementsView(generics.ListAPIView):
    """Historique des mouvements pour un produit spécifique"""
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        product_id = self.kwargs['product_id']
        return StockMovement.objects.filter(
            product_id=product_id
        ).select_related('created_by').order_by('-created_at')


# ── AJUSTEMENT MANUEL ────────────────────────────────────────────

class StockAdjustmentView(APIView):
    """
    Ajustement manuel du stock (perte, casse, correction, retour).
    Toujours tracé dans StockMovement.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        product = get_object_or_404(Product, id=data['product_id'], is_active=True)
        qty = data['quantity']
        before = product.stock_quantity
        after = before + qty

        if after < 0:
            return Response(
                {'error': f'Stock insuffisant. Stock actuel : {before}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mise à jour stock
        product.stock_quantity = after
        product.save(update_fields=['stock_quantity'])

        # Traçabilité
        movement = StockMovement.objects.create(
            product=product,
            movement_type=data['movement_type'],
            quantity=qty,
            stock_before=before,
            stock_after=after,
            note=data.get('note', ''),
            created_by=request.user,
        )

        # Alertes + WebSocket
        _, level = check_and_create_alert(product)
        notify_stock_update(product)
        if level:
            notify_stock_alert(product, level)

        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)


# ── ALERTES ──────────────────────────────────────────────────────

class StockAlertListView(generics.ListAPIView):
    serializer_class = StockAlertSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['alert_level', 'is_read', 'is_resolved']

    def get_queryset(self):
        return StockAlert.objects.filter(
            is_resolved=False
        ).select_related('product').order_by('-created_at')


class StockAlertMarkReadView(APIView):
    """Marque une alerte comme lue"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        alert = get_object_or_404(StockAlert, pk=pk)
        alert.is_read = True
        alert.save(update_fields=['is_read'])
        return Response({'status': 'ok'})


class StockAlertMarkAllReadView(APIView):
    """Marque toutes les alertes comme lues"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = StockAlert.objects.filter(is_read=False).update(is_read=True)
        return Response({'marked': count})


class StockAlertResolveView(APIView):
    """Résout (ferme) une alerte"""
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        alert = get_object_or_404(StockAlert, pk=pk)
        alert.is_resolved = True
        alert.is_read = True
        alert.save(update_fields=['is_resolved', 'is_read'])
        return Response({'status': 'resolved'})


class StockAlertCountView(APIView):
    """Nombre d'alertes non lues (pour badge header)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unread = StockAlert.objects.filter(is_read=False, is_resolved=False).count()
        return Response({'unread_count': unread})
