import django_filters
from .models import Product


class ProductFilter(django_filters.FilterSet):
    min_price     = django_filters.NumberFilter(field_name='selling_price', lookup_expr='gte')
    max_price     = django_filters.NumberFilter(field_name='selling_price', lookup_expr='lte')
    stock_status  = django_filters.CharFilter(method='filter_stock_status')
    category      = django_filters.NumberFilter(field_name='category__id')
    subcategory   = django_filters.NumberFilter(field_name='subcategory__id')
    supplier      = django_filters.NumberFilter(field_name='supplier__id')
    condition     = django_filters.CharFilter(field_name='condition')
    is_active     = django_filters.BooleanFilter(field_name='is_active')
    is_featured   = django_filters.BooleanFilter(field_name='is_featured')

    class Meta:
        model = Product
        fields = ['category', 'subcategory', 'supplier', 'condition', 'is_active', 'is_featured']

    def filter_stock_status(self, queryset, name, value):
        """
        Filtre par statut de stock calculé.
        Pour éviter de charger tous les produits, on filtre via les seuils.
        """
        from apps.settings_app.models import StoreSettings
        store = StoreSettings.get()

        if value == 'out_of_stock':
            return queryset.filter(stock_quantity__lte=0)
        if value == 'critical':
            return queryset.filter(
                stock_quantity__gt=0,
                stock_quantity__lte=store.critical_stock_threshold
            )
        if value == 'low':
            return queryset.filter(
                stock_quantity__gt=store.critical_stock_threshold,
                stock_quantity__lte=store.low_stock_threshold
            )
        if value == 'ok':
            return queryset.filter(stock_quantity__gt=store.low_stock_threshold)
        return queryset
