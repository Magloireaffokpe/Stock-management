from django.conf import settings
from django.db import models


class StockMovement(models.Model):
    """Trace CHAQUE mouvement de stock — cœur de la traçabilité"""

    MOVEMENT_TYPES = [
        ('sale',         'Vente'),
        ('sale_cancel',  'Annulation vente'),
        ('restock',      'Réapprovisionnement'),
        ('adjustment',   'Ajustement manuel'),
        ('loss',         'Perte / Casse'),
        ('return',       'Retour client'),
        ('initial',      'Stock initial'),
    ]

    product        = models.ForeignKey(
        'catalog.Product', on_delete=models.CASCADE, related_name='movements'
    )
    movement_type  = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity       = models.IntegerField()           # + entrée, - sortie
    stock_before   = models.IntegerField()
    stock_after    = models.IntegerField()
    unit_price     = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    reference      = models.CharField(max_length=50, blank=True)
    note           = models.TextField(blank=True)
    created_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Mouvement de stock'

    def __str__(self):
        return f'{self.product.name} {self.movement_type} {self.quantity:+d}'


class StockAlert(models.Model):
    """Alerte auto quand le stock passe sous un seuil"""

    ALERT_LEVELS = [
        ('low',      'Faible'),
        ('critical', 'Critique'),
        ('out',      'Rupture'),
    ]

    product        = models.ForeignKey('catalog.Product', on_delete=models.CASCADE, related_name='alerts')
    alert_level    = models.CharField(max_length=10, choices=ALERT_LEVELS)
    stock_at_alert = models.IntegerField()
    is_read        = models.BooleanField(default=False)
    is_resolved    = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Alerte stock'

    def __str__(self):
        return f'{self.product.name} — {self.alert_level}'
