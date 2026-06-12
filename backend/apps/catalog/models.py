from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    name        = models.CharField(max_length=100)
    slug        = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    icon        = models.CharField(max_length=50, default='package')  # nom icône Lucide
    color       = models.CharField(max_length=7, default='#2563EB')
    order       = models.PositiveIntegerField(default=0)
    is_active   = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Catégorie'
        verbose_name_plural = 'Catégories'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def product_count(self):
        if hasattr(self, '_product_count'):
            return self._product_count
        return self.products.filter(is_active=True).count()

    @product_count.setter
    def product_count(self, value):
        self._product_count = value


class SubCategory(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='subcategories')
    name     = models.CharField(max_length=100)
    slug     = models.SlugField()
    order    = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']
        unique_together = [['category', 'slug']]

    def __str__(self):
        return f'{self.category.name} > {self.name}'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Supplier(models.Model):
    name       = models.CharField(max_length=200)
    phone      = models.CharField(max_length=20, blank=True)
    whatsapp   = models.CharField(max_length=20, blank=True)
    email      = models.EmailField(blank=True)
    address    = models.TextField(blank=True)
    notes      = models.TextField(blank=True)
    is_active  = models.BooleanField(default=True)
    date_added = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Fournisseur'

    def __str__(self):
        return self.name

    @property
    def product_count(self):
        if hasattr(self, '_product_count'):
            return self._product_count
        return self.products.filter(is_active=True).count()

    @product_count.setter
    def product_count(self, value):
        self._product_count = value


class Product(models.Model):
    CONDITION_CHOICES = [
        ('new',         'Neuf'),
        ('used',        'Occasion'),
        ('refurbished', 'Reconditionné'),
    ]

    name             = models.CharField(max_length=200, db_index=True)
    slug             = models.SlugField(unique=True)
    sku              = models.CharField(max_length=50, unique=True, blank=True)
    category         = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    subcategory      = models.ForeignKey(
        SubCategory, on_delete=models.SET_NULL, null=True, blank=True
    )
    description      = models.TextField(blank=True)
    specifications   = models.JSONField(default=dict, blank=True)
    condition        = models.CharField(max_length=15, choices=CONDITION_CHOICES, default='new')
    purchase_price   = models.DecimalField(max_digits=12, decimal_places=0)
    selling_price    = models.DecimalField(max_digits=12, decimal_places=0)
    stock_quantity   = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(null=True, blank=True)
    image            = models.ImageField(upload_to='products/', blank=True, null=True)
    supplier         = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='products'
    )
    is_active        = models.BooleanField(default=True, db_index=True)
    is_featured      = models.BooleanField(default=False)
    date_added       = models.DateTimeField(auto_now_add=True)
    last_updated     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_added']
        verbose_name = 'Produit'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        if not self.sku:
            self.sku = self._generate_sku()
        super().save(*args, **kwargs)

    def _generate_sku(self):
        """Génère un SKU unique : PREFIX-CATPK-XXXXXX (jamais de collision)"""
        import uuid
        prefix = (self.category.name[:3]).upper() if self.category_id else 'PRD'
        suffix = uuid.uuid4().hex[:6].upper()
        return f'{prefix}-{self.category_id or 0}-{suffix}'

    @property
    def margin(self):
        return self.selling_price - self.purchase_price

    @property
    def margin_percent(self):
        if self.purchase_price and self.purchase_price > 0:
            return round((self.margin / self.purchase_price) * 100, 1)
        return 0

    @property
    def stock_status(self):
        from apps.settings_app.models import StoreSettings
        store = StoreSettings.get()
        threshold = self.low_stock_threshold if self.low_stock_threshold is not None else store.low_stock_threshold
        critical = store.critical_stock_threshold
        if self.stock_quantity <= 0:         return 'out_of_stock'
        if self.stock_quantity <= critical:  return 'critical'
        if self.stock_quantity <= threshold: return 'low'
        return 'ok'
