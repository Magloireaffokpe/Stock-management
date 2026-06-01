from django.db import models


class StoreSettings(models.Model):
    """Configuration globale du magasin — singleton (toujours id=1)"""

    store_name               = models.CharField(max_length=100, default='MICROLOGIS')
    tagline                  = models.CharField(max_length=200, blank=True)
    phone                    = models.CharField(max_length=20, blank=True)
    whatsapp                 = models.CharField(max_length=20, blank=True)
    email                    = models.EmailField(blank=True)
    address                  = models.TextField(blank=True)
    city                     = models.CharField(max_length=100, default='Parakou, Bénin')
    currency                 = models.CharField(max_length=10, default='FCFA')
    currency_symbol          = models.CharField(max_length=5, default='F')
    logo                     = models.ImageField(upload_to='logo/', blank=True, null=True)

    # Thème couleurs — appliqué comme CSS variables côté React
    color_primary            = models.CharField(max_length=7, default='#1A2B4A')
    color_accent             = models.CharField(max_length=7, default='#2563EB')
    color_success            = models.CharField(max_length=7, default='#16A34A')

    # Alertes
    low_stock_threshold      = models.PositiveIntegerField(default=5)
    critical_stock_threshold = models.PositiveIntegerField(default=2)
    sound_enabled            = models.BooleanField(default=True)

    # Facturation
    invoice_prefix           = models.CharField(max_length=10, default='MICRO')
    invoice_counter          = models.PositiveIntegerField(default=1)
    quotation_prefix         = models.CharField(max_length=10, default='DEV')
    quotation_counter        = models.PositiveIntegerField(default=1)
    restock_prefix           = models.CharField(max_length=10, default='REAP')
    restock_counter          = models.PositiveIntegerField(default=1)
    tax_rate                 = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    footer_invoice_text      = models.TextField(default='Merci pour votre confiance !')

    class Meta:
        verbose_name = 'Paramètres magasin'

    def __str__(self):
        return self.store_name

    @classmethod
    def get(cls):
        """Toujours récupérer le singleton id=1"""
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
