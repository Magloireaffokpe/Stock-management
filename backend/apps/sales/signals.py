"""
CŒUR DE L'AUTOMATISATION — Signals Django
Tout mouvement de stock passe par ici, jamais via l'interface.

Architecture :
- SaleItem créé → auto_decrement_stock_on_sale
- Sale annulée → géré directement dans SaleCancelView (pas de signal)
  pour éviter les doublons. Le signal post_save Sale est conservé
  uniquement comme garde-fou pour les annulations directes via ORM/admin.
- RestockItem créé → auto_increment_stock_on_restock
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


# ── VENTE : décrémenter le stock ────────────────────────────────

@receiver(post_save, sender='sales.SaleItem')
def auto_decrement_stock_on_sale(sender, instance, created, **kwargs):
    """Quand un SaleItem est créé → décrémente le stock du produit"""
    if not created:
        return
    if instance.sale.is_cancelled:
        return

    from apps.stock.models import StockMovement
    from apps.stock.utils import check_and_create_alert, notify_stock_update, notify_stock_alert

    product = instance.product
    before  = product.stock_quantity
    product.stock_quantity -= instance.quantity
    product.save(update_fields=['stock_quantity'])

    StockMovement.objects.create(
        product=product,
        movement_type='sale',
        quantity=-instance.quantity,
        stock_before=before,
        stock_after=product.stock_quantity,
        unit_price=instance.unit_price,
        reference=instance.sale.invoice_number,
        created_by=instance.sale.created_by,
    )

    _, level = check_and_create_alert(product)
    notify_stock_update(product)
    if level:
        notify_stock_alert(product, level)


# ── RÉAPPRO : incrémenter le stock ──────────────────────────────

@receiver(post_save, sender='sales.RestockItem')
def auto_increment_stock_on_restock(sender, instance, created, **kwargs):
    """Quand un RestockItem est créé → incrémente le stock automatiquement"""
    if not created:
        return

    from apps.stock.models import StockMovement
    from apps.stock.utils import check_and_create_alert, notify_stock_update

    product = instance.product
    before  = product.stock_quantity
    product.stock_quantity  += instance.quantity
    product.purchase_price   = instance.unit_cost
    product.save(update_fields=['stock_quantity', 'purchase_price'])

    StockMovement.objects.create(
        product=product,
        movement_type='restock',
        quantity=instance.quantity,
        stock_before=before,
        stock_after=product.stock_quantity,
        unit_price=instance.unit_cost,
        reference=instance.restock.reference,
        created_by=instance.restock.created_by,
    )
    check_and_create_alert(product)
    notify_stock_update(product)
