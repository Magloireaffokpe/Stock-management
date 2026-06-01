"""
Utilitaires stock partagés entre les signals et les views.
Séparés pour éviter les imports circulaires.
"""


def check_and_create_alert(product):
    """Vérifie le niveau de stock et crée une alerte si nécessaire"""
    from apps.settings_app.models import StoreSettings
    from .models import StockAlert

    store = StoreSettings.get()
    threshold = product.low_stock_threshold if product.low_stock_threshold is not None else store.low_stock_threshold
    critical = store.critical_stock_threshold

    level = None
    if product.stock_quantity <= 0:         level = 'out'
    elif product.stock_quantity <= critical: level = 'critical'
    elif product.stock_quantity <= threshold: level = 'low'

    if level:
        # get_or_create pour éviter les doublons d'alertes non résolues
        alert, created = StockAlert.objects.get_or_create(
            product=product,
            alert_level=level,
            is_resolved=False,
            defaults={'stock_at_alert': product.stock_quantity},
        )
        return alert, level

    # Résoudre les alertes précédentes si le stock est revenu à la normale
    StockAlert.objects.filter(product=product, is_resolved=False).update(is_resolved=True)
    return None, None


def notify_stock_update(product):
    """Broadcast WebSocket à tous les clients connectés"""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        async_to_sync(channel_layer.group_send)(
            'stock_alerts',
            {
                'type':           'stock_update',
                'product_id':     product.id,
                'product_name':   product.name,
                'stock_quantity': product.stock_quantity,
                'stock_status':   product.stock_status,
            }
        )
    except Exception:
        # Ne jamais bloquer une transaction sur un échec WebSocket
        pass


def notify_stock_alert(product, level):
    """Broadcast alerte critique WebSocket"""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        async_to_sync(channel_layer.group_send)(
            'stock_alerts',
            {
                'type':           'stock_alert',
                'product_id':     product.id,
                'product_name':   product.name,
                'alert_level':    level,
                'stock_quantity': product.stock_quantity,
            }
        )
    except Exception:
        pass
