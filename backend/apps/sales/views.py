from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from .models import Client, Sale, SaleItem, Quotation, QuotationItem, Restock, RestockItem
from .serializers import (
    ClientSerializer,
    SaleSerializer, SaleListSerializer, SaleCreateSerializer,
    QuotationSerializer,
    RestockSerializer, RestockCreateSerializer,
)
from .access import visible_sales_queryset


# ── CLIENTS ───────────────────────────────────────────────────────

class ClientListCreateView(generics.ListCreateAPIView):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['first_name', 'last_name', 'phone', 'whatsapp']
    ordering_fields = ['last_name', 'date_added']
    queryset = Client.objects.all()


class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    queryset = Client.objects.all()


# ── VENTES ────────────────────────────────────────────────────────

class SaleListView(generics.ListAPIView):
    serializer_class = SaleListSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['invoice_number', 'client__first_name', 'client__last_name']
    filterset_fields = ['payment_method', 'is_cancelled', 'created_by']
    ordering_fields = ['created_at', 'total_amount', 'sale_date']

    def get_queryset(self):
        qs = visible_sales_queryset(
            self.request.user,
            Sale.objects.prefetch_related('items__product').select_related('client', 'created_by'),
        )

        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(sale_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(sale_date__date__lte=date_to)

        return qs


class SaleDetailView(generics.RetrieveAPIView):
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return visible_sales_queryset(
            self.request.user,
            Sale.objects.prefetch_related('items__product').select_related(
                'client', 'created_by', 'cancelled_by'
            ),
        )


class SaleCreateView(APIView):
    """
    Crée une vente complète en une seule transaction atomique.
    Les signals gèrent automatiquement la décrémentation du stock.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Récupération et validation des produits
        items_data = data['items']
        products = {}
        for item in items_data:
            try:
                product = Product.objects.select_for_update().get(
                    id=item['product_id'], is_active=True
                )
            except Product.DoesNotExist:
                return Response(
                    {'error': f"Produit ID {item['product_id']} introuvable"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if product.stock_quantity < item['quantity']:
                return Response(
                    {'error': f"Stock insuffisant pour « {product.name} » (dispo: {product.stock_quantity})"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            products[item['product_id']] = product

        # Calcul des montants
        from apps.settings_app.models import StoreSettings
        store   = StoreSettings.get()
        subtotal = sum(
            item['unit_price'] * item['quantity'] for item in items_data
        )
        tax_amount = (subtotal * store.tax_rate / 100).quantize(Decimal('1'))
        total      = subtotal + tax_amount
        amount_paid = data['amount_paid']
        change_given = max(amount_paid - total, Decimal(0))

        # Création de la vente
        sale = Sale.objects.create(
            client_id=data.get('client_id'),
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_amount=total,
            payment_method=data['payment_method'],
            amount_paid=amount_paid,
            change_given=change_given,
            notes=data.get('notes', ''),
            created_by=request.user,
        )

        # Création des lignes (les signals décrémenteront le stock)
        for item in items_data:
            product = products[item['product_id']]
            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=product.name,
                quantity=item['quantity'],
                unit_price=item['unit_price'],
                subtotal=item['unit_price'] * item['quantity'],
            )

        sale.refresh_from_db()
        
        from apps.settings_app.utils import log_audit_action
        log_audit_action(request, 'sale', f"Vente #{sale.invoice_number} enregistrée ({total} {store.currency})")
        
        return Response(
            SaleSerializer(sale).data,
            status=status.HTTP_201_CREATED
        )


class SaleCancelView(APIView):
    """Annule une vente — le signal restaure automatiquement le stock"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            sale = Sale.objects.select_for_update().get(pk=pk)
        except Sale.DoesNotExist:
            return Response({'error': 'Vente introuvable'}, status=404)

        if sale.is_cancelled:
            return Response({'error': 'Vente déjà annulée'}, status=400)

        # Seul l'admin ou le créateur peut annuler
        user = request.user
        if not (user.is_staff or getattr(user, 'role', '') == 'admin' or sale.created_by == user):
            return Response({'error': 'Permission refusée'}, status=403)

        # Restaurer le stock AVANT de marquer annulée (évite doublons avec signal)
        from apps.stock.models import StockMovement
        from apps.stock.utils import notify_stock_update, check_and_create_alert
        for item in sale.items.select_related('product').all():
            product = item.product
            before  = product.stock_quantity
            product.stock_quantity += item.quantity
            product.save(update_fields=['stock_quantity'])
            StockMovement.objects.create(
                product=product,
                movement_type='sale_cancel',
                quantity=item.quantity,
                stock_before=before,
                stock_after=product.stock_quantity,
                reference=sale.invoice_number,
                created_by=user,
            )
            check_and_create_alert(product)
            notify_stock_update(product)

        # Marquer annulée avec cancelled_at déjà défini → le signal verra
        # cancelled_at non nul et ne restaurera pas une 2e fois
        sale.is_cancelled = True
        sale.cancelled_at = timezone.now()
        sale.cancelled_by = user
        sale.save(update_fields=['is_cancelled', 'cancelled_at', 'cancelled_by'])

        from apps.settings_app.utils import log_audit_action
        log_audit_action(request, 'update', f"Annulation de la vente #{sale.invoice_number}")

        return Response(SaleSerializer(sale).data)


# ── DEVIS ──────────────────────────────────────────────────────────

class QuotationListCreateView(generics.ListCreateAPIView):
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'client']
    search_fields = ['quotation_number', 'client__first_name', 'client__last_name']

    def get_queryset(self):
        return Quotation.objects.prefetch_related('items').select_related('client', 'created_by').all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class QuotationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Quotation.objects.prefetch_related('items').select_related('client').all()


class QuotationConvertView(APIView):
    """Convertit un devis en vente"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            quotation = Quotation.objects.select_for_update().get(pk=pk)
        except Quotation.DoesNotExist:
            return Response({'error': 'Devis introuvable'}, status=404)

        if quotation.status not in ('draft', 'sent'):
            return Response({'error': 'Ce devis ne peut plus être converti'}, status=400)

        from apps.catalog.models import Product
        from apps.settings_app.models import StoreSettings

        # Vérification des stocks
        products = {}
        for item in quotation.items.select_related('product').all():
            try:
                product = Product.objects.select_for_update().get(id=item.product_id, is_active=True)
            except Product.DoesNotExist:
                return Response({'error': f"Produit introuvable ou inactif pour le devis"}, status=400)
            
            if product.stock_quantity < item.quantity:
                return Response(
                    {'error': f"Conversion impossible : stock insuffisant pour « {product.name} » (dispo: {product.stock_quantity})"},
                    status=400
                )
            products[item.product_id] = product

        store = StoreSettings.get()
        subtotal = sum(item.unit_price * item.quantity for item in quotation.items.all())
        tax_amount = (subtotal * store.tax_rate / 100).quantize(Decimal('1'))
        total = subtotal + tax_amount

        # Gestion des paiements
        try:
            amount_paid = Decimal(request.data.get('amount_paid', total))
        except (ValueError, TypeError):
            amount_paid = total
        change_given = max(amount_paid - total, Decimal('0'))

        # Création de la vente
        sale = Sale.objects.create(
            client_id=quotation.client_id,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_amount=total,
            payment_method=request.data.get('payment_method', 'cash'),
            amount_paid=amount_paid,
            change_given=change_given,
            notes=f"Converti depuis le devis {quotation.quotation_number}",
            created_by=request.user,
        )

        # Création des lignes (les signals décrémenteront le stock)
        for item in quotation.items.all():
            product = products[item.product_id]
            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=product.name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.unit_price * item.quantity,
            )

        # Mise à jour du devis
        quotation.status = 'accepted'
        quotation.converted_to_sale = sale
        quotation.save(update_fields=['status', 'converted_to_sale'])

        from apps.settings_app.utils import log_audit_action
        log_audit_action(request, 'conversion', f"Conversion du devis #{quotation.quotation_number} en vente #{sale.invoice_number}")

        sale.refresh_from_db()
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)


# ── RÉAPPROS ──────────────────────────────────────────────────────

class RestockListView(generics.ListAPIView):
    serializer_class = RestockSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['reference', 'supplier__name']
    filterset_fields = ['supplier']
    ordering_fields = ['restock_date', 'created_at']

    def get_queryset(self):
        return Restock.objects.prefetch_related('items__product').select_related(
            'supplier', 'created_by'
        ).all()


class RestockCreateView(APIView):
    """
    Crée un réapprovisionnement.
    Les signals auto-incrémentent le stock pour chaque RestockItem.
    """
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request):
        serializer = RestockCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Vérifier que les produits existent
        items_data = data['items']
        for item in items_data:
            if not Product.objects.filter(id=item['product_id'], is_active=True).exists():
                return Response(
                    {'error': f"Produit ID {item['product_id']} introuvable"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        import datetime
        restock = Restock.objects.create(
            supplier_id=data.get('supplier_id'),
            restock_date=data.get('restock_date', datetime.date.today()),
            notes=data.get('notes', ''),
            created_by=request.user,
        )

        # Création des lignes (les signals incrémentent le stock)
        for item in items_data:
            RestockItem.objects.create(
                restock=restock,
                product_id=item['product_id'],
                quantity=item['quantity'],
            )

        from apps.settings_app.utils import log_audit_action
        log_audit_action(request, 'restock', f"Réapprovisionnement #{restock.reference} enregistré")

        return Response(
            RestockSerializer(restock).data,
            status=status.HTTP_201_CREATED
        )


class RestockDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RestockSerializer
    permission_classes = [IsAuthenticated]
    queryset = Restock.objects.prefetch_related('items__product').select_related('supplier', 'created_by').all()

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Met à jour un réappro de façon atomique.
        Le stock est ajusté par la différence (nouvelle qté - ancienne qté)
        et chaque écart est tracé dans StockMovement."""
        from apps.stock.models import StockMovement
        from apps.stock.utils import check_and_create_alert, notify_stock_update

        try:
            restock = Restock.objects.select_for_update().get(pk=kwargs['pk'])
        except Restock.DoesNotExist:
            return Response({'error': 'Réapprovisionnement introuvable'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RestockCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Anciennes quantités
        old_items = {}
        for item in restock.items.select_related('product').all():
            old_items[item.product_id] = item.quantity

        # Nouvelles quantités (fusion par produit)
        new_items = {}
        for item in data['items']:
            if not Product.objects.filter(id=item['product_id'], is_active=True).exists():
                return Response(
                    {'error': f"Produit ID {item['product_id']} introuvable"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            new_items[item['product_id']] = new_items.get(item['product_id'], 0) + item['quantity']

        # Vérifier que le stock restera positif (validation AVANT toute écriture)
        all_pids = set(old_items) | set(new_items)
        products = {
            p.id: p for p in Product.objects.select_for_update().filter(id__in=all_pids)
        }
        for pid in all_pids:
            delta = new_items.get(pid, 0) - old_items.get(pid, 0)
            product = products[pid]
            if product.stock_quantity + delta < 0:
                return Response(
                    {'error': f"Stock insuffisant pour « {product.name} » (dispo: {product.stock_quantity})"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Appliquer les écarts de stock + traçabilité
        for pid in all_pids:
            delta = new_items.get(pid, 0) - old_items.get(pid, 0)
            if delta == 0:
                continue
            product = products[pid]
            before = product.stock_quantity
            after = before + delta
            product.stock_quantity = after
            product.save(update_fields=['stock_quantity'])
            StockMovement.objects.create(
                product=product,
                movement_type='restock' if delta > 0 else 'restock_cancel',
                quantity=delta,
                stock_before=before,
                stock_after=after,
                reference=restock.reference,
                created_by=request.user,
            )
            check_and_create_alert(product)
            notify_stock_update(product)

        # Mise à jour des champs + remplacement des lignes
        restock.supplier_id = data.get('supplier_id', restock.supplier_id)
        restock.restock_date = data.get('restock_date', restock.restock_date)
        restock.notes = data.get('notes', restock.notes)
        restock.save(update_fields=['supplier', 'restock_date', 'notes'])

        restock.items.all().delete()
        RestockItem.objects.bulk_create([
            RestockItem(restock=restock, product_id=pid, quantity=qty)
            for pid, qty in new_items.items()
        ])

        from apps.settings_app.utils import log_audit_action
        log_audit_action(request, 'update', f"Réapprovisionnement #{restock.reference} modifié")

        restock.refresh_from_db()
        return Response(RestockSerializer(restock).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """Supprime un réappro de façon atomique.
        Le stock est diminué des quantités réapprovisionnées et l'annulation
        est tracée dans StockMovement."""
        from apps.stock.models import StockMovement
        from apps.stock.utils import check_and_create_alert, notify_stock_update

        try:
            restock = Restock.objects.select_for_update().get(pk=kwargs['pk'])
        except Restock.DoesNotExist:
            return Response({'error': 'Réapprovisionnement introuvable'}, status=status.HTTP_404_NOT_FOUND)

        items = list(restock.items.select_related('product').all())
        if not items:
            restock.delete()
            return Response({'status': 'deleted'})

        # Verrouiller les produits et vérifier que le stock suffira
        locked = {}
        for item in items:
            product = Product.objects.select_for_update().get(pk=item.product_id)
            before = product.stock_quantity
            after = before - item.quantity
            if after < 0:
                return Response(
                    {'error': f"Suppression impossible : stock insuffisant pour « {product.name} » (dispo: {before})"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            locked[item.product_id] = (product, item, before, after)

        for product, item, before, after in locked.values():
            product.stock_quantity = after
            product.save(update_fields=['stock_quantity'])
            StockMovement.objects.create(
                product=product,
                movement_type='restock_cancel',
                quantity=-item.quantity,
                stock_before=before,
                stock_after=after,
                reference=restock.reference,
                created_by=request.user,
            )
            check_and_create_alert(product)
            notify_stock_update(product)

        ref = restock.reference
        restock.delete()

        from apps.settings_app.utils import log_audit_action
        log_audit_action(request, 'delete', f"Réapprovisionnement #{ref} supprimé (stock ajusté)")

        return Response({'status': 'deleted', 'reference': ref})
