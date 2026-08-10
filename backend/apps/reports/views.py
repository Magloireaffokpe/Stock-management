from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Avg, Q, F
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


from apps.sales.models import Sale, SaleItem
from apps.sales.access import visible_sales_queryset
from apps.catalog.models import Product, Category
from apps.stock.models import StockAlert


def get_period_totals(date_from, date_to):
    """Calcule CA, bénéfice, nb ventes pour une période"""
    sales = Sale.objects.filter(
        is_cancelled=False,
        sale_date__date__gte=date_from,
        sale_date__date__lte=date_to,
    )
    agg = sales.aggregate(
        total_revenue=Sum("total_amount"),
        total_discount=Sum("discount"),
        count=Count("id"),
    )
    items = SaleItem.objects.filter(
        sale__is_cancelled=False,
        sale__sale_date__date__gte=date_from,
        sale__sale_date__date__lte=date_to,
    ).aggregate(
        total_margin=Sum((F("unit_price") - F("purchase_price")) * F("quantity"))
    )
    return {
        "revenue": agg["total_revenue"] or 0,
        "discount": agg["total_discount"] or 0,
        "profit": items["total_margin"] or 0,
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

        # Périodes actuelles
        day = get_period_totals(today, today)
        week = get_period_totals(week_start, today)
        month = get_period_totals(month_start, today)
        year = get_period_totals(year_start, today)

        # Périodes précédentes (pour variation %)
        prev_day_start = yesterday
        prev_week_start = week_start - timedelta(weeks=1)
        prev_week_end = week_start - timedelta(days=1)
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
        prev_month_end = month_start - timedelta(days=1)
        prev_year_start = year_start.replace(year=year_start.year - 1)
        prev_year_end = year_start - timedelta(days=1)

        prev_day = get_period_totals(prev_day_start, yesterday)
        prev_week = get_period_totals(prev_week_start, prev_week_end)
        prev_month = get_period_totals(prev_month_start, prev_month_end)
        prev_year = get_period_totals(prev_year_start, prev_year_end)

        def variation(current, previous):
            if not previous:
                return 100 if current else 0
            return round(((current - previous) / previous) * 100, 1)

        # Stock
        from apps.settings_app.models import StoreSettings

        store = StoreSettings.get()
        out_of_stock = Product.objects.filter(
            is_active=True, stock_quantity__lte=0
        ).count()
        critical = Product.objects.filter(
            is_active=True,
            stock_quantity__gt=0,
            stock_quantity__lte=store.critical_stock_threshold,
        ).count()
        low = Product.objects.filter(
            is_active=True,
            stock_quantity__gt=store.critical_stock_threshold,
            stock_quantity__lte=store.low_stock_threshold,
        ).count()
        total_products = Product.objects.filter(is_active=True).count()
        unread_alerts = StockAlert.objects.filter(
            is_read=False, is_resolved=False
        ).count()

        return Response(
            {
                "today": {
                    "revenue": day["revenue"],
                    "profit": day["profit"],
                    "count": day["count"],
                    "variation_revenue": variation(day["revenue"], prev_day["revenue"]),
                    "variation_count": variation(day["count"], prev_day["count"]),
                },
                "week": {
                    "revenue": week["revenue"],
                    "profit": week["profit"],
                    "count": week["count"],
                    "variation_revenue": variation(
                        week["revenue"], prev_week["revenue"]
                    ),
                },
                "month": {
                    "revenue": month["revenue"],
                    "profit": month["profit"],
                    "count": month["count"],
                    "variation_revenue": variation(
                        month["revenue"], prev_month["revenue"]
                    ),
                    "variation_profit": variation(
                        month["profit"], prev_month["profit"]
                    ),
                },
                "year": {
                    "revenue": year["revenue"],
                    "profit": year["profit"],
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

        sales = (
            Sale.objects.filter(
                is_cancelled=False,
                sale_date__date__gte=start_date,
                sale_date__date__lte=end_date,
            )
            .annotate(day=TruncDay("sale_date"))
            .values("day")
            .annotate(
                revenue=Sum("total_amount"),
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

        sales = (
            Sale.objects.filter(
                is_cancelled=False,
                sale_date__date__gte=start,
            )
            .annotate(month=TruncMonth("sale_date"))
            .values("month")
            .annotate(
                revenue=Sum("total_amount"),
                count=Count("id"),
                profit=Sum(
                    (F("items__unit_price") - F("items__purchase_price"))
                    * F("items__quantity")
                ),
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
                    "profit": s["profit"] or 0,
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

        qs = SaleItem.objects.filter(sale__is_cancelled=False)
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
                total_margin=Sum(
                    (F("unit_price") - F("purchase_price")) * F("quantity")
                ),
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

        qs = SaleItem.objects.filter(sale__is_cancelled=False)
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


class StockValueView(APIView):
    """Valeur totale du stock (achat & vente)"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, F as Fld, ExpressionWrapper, DecimalField

        agg = Product.objects.filter(is_active=True).aggregate(
            total_purchase_value=Sum(
                ExpressionWrapper(
                    Fld("purchase_price") * Fld("stock_quantity"),
                    output_field=DecimalField(),
                )
            ),
            total_selling_value=Sum(
                ExpressionWrapper(
                    Fld("selling_price") * Fld("stock_quantity"),
                    output_field=DecimalField(),
                )
            ),
            total_products=Count("id"),
            total_units=Sum("stock_quantity"),
        )

        return Response(
            {
                "purchase_value": agg["total_purchase_value"] or 0,
                "selling_value": agg["total_selling_value"] or 0,
                "total_products": agg["total_products"],
                "total_units": agg["total_units"] or 0,
                "potential_profit": (agg["total_selling_value"] or 0)
                - (agg["total_purchase_value"] or 0),
            }
        )


class RecentSalesView(APIView):
    """5 dernières ventes pour le dashboard"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.sales.serializers import SaleListSerializer

        sales = visible_sales_queryset(
            request.user,
            Sale.objects.select_related("client", "created_by")
            .filter(is_cancelled=False)
            .order_by("-created_at"),
        )[:5]
        return Response(SaleListSerializer(sales, many=True).data)


class PaymentMethodStatsView(APIView):
    """Répartition des ventes par méthode de paiement"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        qs = Sale.objects.filter(is_cancelled=False)
        if date_from:
            qs = qs.filter(sale_date__date__gte=date_from)
        if date_to:
            qs = qs.filter(sale_date__date__lte=date_to)

        stats = (
            qs.values("payment_method")
            .annotate(
                count=Count("id"),
                total=Sum("total_amount"),
            )
            .order_by("-total")
        )

        return Response(list(stats))
