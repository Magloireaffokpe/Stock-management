from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Count
from django.db.models.functions import TruncDay, TruncMonth
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


from apps.sales.models import Sale, SaleItem
from apps.sales.access import visible_sales_queryset
from apps.catalog.models import Product, Category
from apps.stock.models import StockAlert


def get_period_totals(date_from, date_to, store_id=None):
    """Calcule CA (prix de vente effectif) et nb ventes pour une période"""
    if store_id:
        agg = SaleItem.objects.filter(
            sale__is_cancelled=False,
            sale__sale_date__date__gte=date_from,
            sale__sale_date__date__lte=date_to,
            product__store_id=store_id
        ).aggregate(
            total_revenue=Sum("subtotal"),
            count=Count("sale_id", distinct=True)
        )
        return {
            "revenue": agg["total_revenue"] or 0,
            "count": agg["count"] or 0,
        }
    else:
        sales = Sale.objects.filter(
            is_cancelled=False,
            sale_date__date__gte=date_from,
            sale_date__date__lte=date_to,
        )
        agg = sales.aggregate(
            total_revenue=Sum("subtotal"),
            count=Count("id"),
        )
        return {
            "revenue": agg["total_revenue"] or 0,
            "count": agg["count"] or 0,
        }


class DashboardKPIView(APIView):
    """KPIs pour le tableau de bord — CA jour / semaine / mois / année + variations"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        yesterday = today - timedelta(days=1)
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        store_id = request.query_params.get("store")

        # Périodes actuelles
        day = get_period_totals(today, today, store_id=store_id)
        week = get_period_totals(week_start, today, store_id=store_id)
        month = get_period_totals(month_start, today, store_id=store_id)
        year = get_period_totals(year_start, today, store_id=store_id)

        # Périodes précédentes (pour variation %)
        prev_day_start = yesterday
        prev_week_start = week_start - timedelta(weeks=1)
        prev_week_end = week_start - timedelta(days=1)
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
        prev_month_end = month_start - timedelta(days=1)
        prev_year_start = year_start.replace(year=year_start.year - 1)
        prev_year_end = year_start - timedelta(days=1)

        prev_day = get_period_totals(prev_day_start, yesterday, store_id=store_id)
        prev_week = get_period_totals(prev_week_start, prev_week_end, store_id=store_id)
        prev_month = get_period_totals(prev_month_start, prev_month_end, store_id=store_id)
        prev_year = get_period_totals(prev_year_start, prev_year_end, store_id=store_id)

        def variation(current, previous):
            if not previous:
                return 100 if current else 0
            return round(((current - previous) / previous) * 100, 1)

        # Stock
        from apps.settings_app.models import StoreSettings

        store = StoreSettings.get()
        products_qs = Product.objects.filter(is_active=True)
        alerts_qs = StockAlert.objects.filter(is_read=False, is_resolved=False)
        if store_id:
            products_qs = products_qs.filter(store_id=store_id)
            alerts_qs = alerts_qs.filter(product__store_id=store_id)

        out_of_stock = products_qs.filter(stock_quantity__lte=0).count()
        critical = products_qs.filter(
            stock_quantity__gt=0,
            stock_quantity__lte=store.critical_stock_threshold,
        ).count()
        low = products_qs.filter(
            stock_quantity__gt=store.critical_stock_threshold,
            stock_quantity__lte=store.low_stock_threshold,
        ).count()
        total_products = products_qs.count()
        unread_alerts = alerts_qs.count()

        return Response(
            {
                "today": {
                    "revenue": day["revenue"],
                    "count": day["count"],
                    "variation_revenue": variation(day["revenue"], prev_day["revenue"]),
                    "variation_count": variation(day["count"], prev_day["count"]),
                },
                "week": {
                    "revenue": week["revenue"],
                    "count": week["count"],
                    "variation_revenue": variation(
                        week["revenue"], prev_week["revenue"]
                    ),
                },
                "month": {
                    "revenue": month["revenue"],
                    "count": month["count"],
                    "variation_revenue": variation(
                        month["revenue"], prev_month["revenue"]
                    ),
                },
                "year": {
                    "revenue": year["revenue"],
                    "count": year["count"],
                    "variation_revenue": variation(
                        year["revenue"], prev_year["revenue"]
                    ),
                },
                "stock": {
                    "total_products": total_products,
                    "out_of_stock": out_of_stock,
                    "critical": critical,
                    "low": low,
                    "unread_alerts": unread_alerts,
                },
            }
        )


class SalesChartView(APIView):
    """Données graphique barres — ventes des N derniers jours"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get("days", 7))
        end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)
        store_id = request.query_params.get("store")

        if store_id:
            sales = (
                SaleItem.objects.filter(
                    sale__is_cancelled=False,
                    sale__sale_date__date__gte=start_date,
                    sale__sale_date__date__lte=end_date,
                    product__store_id=store_id
                )
                .annotate(day=TruncDay("sale__sale_date"))
                .values("day")
                .annotate(
                    revenue=Sum("subtotal"),
                    count=Count("sale_id", distinct=True),
                )
                .order_by("day")
            )
        else:
            sales = (
                Sale.objects.filter(
                    is_cancelled=False,
                    sale_date__date__gte=start_date,
                    sale_date__date__lte=end_date,
                )
                .annotate(day=TruncDay("sale_date"))
                .values("day")
                .annotate(
                    revenue=Sum("subtotal"),
                    count=Count("id"),
                )
                .order_by("day")
            )

        # Remplir les jours sans ventes avec 0
        sales_by_day = {s["day"].date(): s for s in sales}
        result = []
        current = start_date
        while current <= end_date:
            s = sales_by_day.get(current, {})
            result.append(
                {
                    "date": current.isoformat(),
                    "revenue": s.get("revenue", 0),
                    "count": s.get("count", 0),
                    "is_today": current == end_date,
                }
            )
            current += timedelta(days=1)

        return Response(result)


class MonthlySalesChartView(APIView):
    """Courbe CA mensuel — 12 derniers mois"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        end = date.today()
        start = end.replace(day=1) - timedelta(days=365)
        store_id = request.query_params.get("store")

        if store_id:
            sales = (
                SaleItem.objects.filter(
                    sale__is_cancelled=False,
                    sale__sale_date__date__gte=start,
                    product__store_id=store_id
                )
                .annotate(month=TruncMonth("sale__sale_date"))
                .values("month")
                .annotate(
                    revenue=Sum("subtotal"),
                    count=Count("sale_id", distinct=True),
                )
                .order_by("month")
            )
        else:
            sales = (
                Sale.objects.filter(
                    is_cancelled=False,
                    sale_date__date__gte=start,
                )
                .annotate(month=TruncMonth("sale_date"))
                .values("month")
                .annotate(
                    revenue=Sum("subtotal"),
                    count=Count("id"),
                )
                .order_by("month")
            )

        return Response(
            [
                {
                    "month": s["month"].strftime("%Y-%m"),
                    "label": s["month"].strftime("%b %Y"),
                    "revenue": s["revenue"] or 0,
                    "count": s["count"],
                }
                for s in sales
            ]
        )


class TopProductsView(APIView):
    """Top produits les plus vendus"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int(request.query_params.get("limit", 10))
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        store_id = request.query_params.get("store")

        qs = SaleItem.objects.filter(sale__is_cancelled=False)
        if store_id:
            qs = qs.filter(product__store_id=store_id)
        if date_from:
            qs = qs.filter(sale__sale_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(sale__sale_date__date__lte=date_to)

        top = (
            qs.values(
                "product__id",
                "product__name",
                "product__sku",
                "product__category__name",
                "product__category__color",
            )
            .annotate(
                total_qty=Sum("quantity"),
                total_revenue=Sum("subtotal"),
            )
            .order_by("-total_revenue")[:limit]
        )

        return Response(list(top))


class CategorySalesView(APIView):
    """Répartition des ventes par catégorie (pour pie chart)"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        store_id = request.query_params.get("store")

        qs = SaleItem.objects.filter(sale__is_cancelled=False)
        if store_id:
            qs = qs.filter(product__store_id=store_id)
        if date_from:
            qs = qs.filter(sale__sale_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(sale__sale_date__date__lte=date_to)

        by_cat = (
            qs.values(
                "product__category__id",
                "product__category__name",
                "product__category__color",
            )
            .annotate(
                total_revenue=Sum("subtotal"),
                total_qty=Sum("quantity"),
            )
            .order_by("-total_revenue")
        )

        return Response(list(by_cat))


class RecentSalesView(APIView):
    """5 dernières ventes pour le dashboard"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.sales.serializers import SaleListSerializer

        store_id = request.query_params.get("store")
        sales_qs = Sale.objects.select_related("client", "created_by").filter(is_cancelled=False)
        if store_id:
            sales_qs = sales_qs.filter(items__product__store_id=store_id).distinct()

        sales = visible_sales_queryset(
            request.user,
            sales_qs.order_by("-created_at"),
        )[:5]
        return Response(SaleListSerializer(sales, many=True).data)
