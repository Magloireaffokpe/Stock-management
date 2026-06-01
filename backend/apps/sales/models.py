from datetime import date

from django.conf import settings
from django.db import models
from django.utils import timezone


class Client(models.Model):
    first_name = models.CharField(max_length=100, blank=True)
    last_name  = models.CharField(max_length=100, blank=True)
    phone      = models.CharField(max_length=20, blank=True)
    whatsapp   = models.CharField(max_length=20, blank=True)
    address    = models.TextField(blank=True)
    notes      = models.TextField(blank=True)
    date_added = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['last_name', 'first_name']
        verbose_name = 'Client'

    def __str__(self):
        return self.full_name

    @property
    def full_name(self):
        name = f'{self.first_name} {self.last_name}'.strip()
        return name or 'Client comptoir'

    @property
    def total_purchases(self):
        return self.sales.filter(is_cancelled=False).aggregate(
            total=models.Sum('total_amount')
        )['total'] or 0

    @property
    def purchases_count(self):
        return self.sales.filter(is_cancelled=False).count()


def generate_invoice_number():
    from apps.settings_app.models import StoreSettings
    settings_obj = StoreSettings.objects.select_for_update().get(id=1)
    year = date.today().year
    num = str(settings_obj.invoice_counter).zfill(4)
    settings_obj.invoice_counter += 1
    settings_obj.save(update_fields=['invoice_counter'])
    return f'{settings_obj.invoice_prefix}-{year}-{num}'


def generate_quotation_number():
    from apps.settings_app.models import StoreSettings
    settings_obj = StoreSettings.objects.select_for_update().get(id=1)
    year = date.today().year
    num = str(settings_obj.quotation_counter).zfill(4)
    settings_obj.quotation_counter += 1
    settings_obj.save(update_fields=['quotation_counter'])
    return f'{settings_obj.quotation_prefix}-{year}-{num}'


def generate_restock_reference():
    from apps.settings_app.models import StoreSettings
    settings_obj = StoreSettings.objects.select_for_update().get(id=1)
    year = date.today().year
    num = str(settings_obj.restock_counter).zfill(4)
    settings_obj.restock_counter += 1
    settings_obj.save(update_fields=['restock_counter'])
    return f'{settings_obj.restock_prefix}-{year}-{num}'


class Sale(models.Model):
    PAYMENT_METHODS = [
        ('cash',     'Espèces'),
        ('mtn',      'MTN Mobile Money'),
        ('moov',     'Moov Money'),
        ('card',     'Carte bancaire'),
        ('transfer', 'Virement'),
        ('mixed',    'Mixte'),
    ]

    invoice_number = models.CharField(max_length=30, unique=True, blank=True)
    client         = models.ForeignKey(
        Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales'
    )
    sale_date      = models.DateTimeField(default=timezone.now)
    subtotal       = models.DecimalField(max_digits=14, decimal_places=0)
    discount       = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    tax_amount     = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    total_amount   = models.DecimalField(max_digits=14, decimal_places=0)
    payment_method = models.CharField(max_length=15, choices=PAYMENT_METHODS, default='cash')
    amount_paid    = models.DecimalField(max_digits=14, decimal_places=0)
    change_given   = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    notes          = models.TextField(blank=True)
    is_cancelled   = models.BooleanField(default=False)
    cancelled_at   = models.DateTimeField(null=True, blank=True)
    cancelled_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cancelled_sales'
    )
    created_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_sales'
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    pdf_file       = models.FileField(upload_to='factures/', blank=True, null=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Vente'

    def __str__(self):
        return self.invoice_number

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = generate_invoice_number()
        super().save(*args, **kwargs)

    @property
    def total_margin(self):
        return sum(item.margin for item in self.items.all())


class SaleItem(models.Model):
    sale           = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product        = models.ForeignKey('catalog.Product', on_delete=models.PROTECT)
    product_name   = models.CharField(max_length=200)   # snapshot nom au moment vente
    quantity       = models.PositiveIntegerField()
    unit_price     = models.DecimalField(max_digits=12, decimal_places=0)  # prix négocié
    purchase_price = models.DecimalField(max_digits=12, decimal_places=0)  # snapshot marge
    subtotal       = models.DecimalField(max_digits=14, decimal_places=0)

    class Meta:
        verbose_name = 'Ligne de vente'

    @property
    def margin(self):
        return (self.unit_price - self.purchase_price) * self.quantity


class Quotation(models.Model):
    STATUS_CHOICES = [
        ('draft',    'Brouillon'),
        ('sent',     'Envoyé'),
        ('accepted', 'Accepté'),
        ('refused',  'Refusé'),
        ('expired',  'Expiré'),
    ]

    quotation_number  = models.CharField(max_length=30, unique=True, blank=True)
    client            = models.ForeignKey(
        Client, on_delete=models.SET_NULL, null=True, blank=True
    )
    status            = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    valid_until       = models.DateField(null=True, blank=True)
    total_amount      = models.DecimalField(max_digits=14, decimal_places=0)
    notes             = models.TextField(blank=True)
    converted_to_sale = models.OneToOneField(
        Sale, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_by        = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Devis'

    def __str__(self):
        return self.quotation_number

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            self.quotation_number = generate_quotation_number()
        super().save(*args, **kwargs)


class QuotationItem(models.Model):
    quotation  = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='items')
    product    = models.ForeignKey('catalog.Product', on_delete=models.PROTECT)
    quantity   = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=0)
    subtotal   = models.DecimalField(max_digits=14, decimal_places=0)


class Restock(models.Model):
    """Réapprovisionnement — incrémente le stock automatiquement via signal"""

    reference    = models.CharField(max_length=50, blank=True)
    supplier     = models.ForeignKey(
        'catalog.Supplier', on_delete=models.SET_NULL, null=True, blank=True
    )
    restock_date = models.DateField(default=date.today)
    total_cost   = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    notes        = models.TextField(blank=True)
    created_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Réapprovisionnement'

    def __str__(self):
        return self.reference or f'Réappro #{self.id}'

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = generate_restock_reference()
        super().save(*args, **kwargs)


class RestockItem(models.Model):
    restock   = models.ForeignKey(Restock, on_delete=models.CASCADE, related_name='items')
    product   = models.ForeignKey('catalog.Product', on_delete=models.PROTECT)
    quantity  = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=0)

    class Meta:
        verbose_name = 'Ligne de réappro'
