"""Règles de visibilité des ventes selon le rôle de l'utilisateur."""

from datetime import timedelta

from django.utils import timezone


EMPLOYEE_SALES_HISTORY_DAYS = 7


def user_is_admin(user):
    return (
        user.is_staff
        or user.is_superuser
        or getattr(user, "role", "") == "admin"
    )


def visible_sales_queryset(user, queryset):
    """Retourne les ventes consultables par ``user``.

    Les administrateurs ont accès à l'historique complet. Un employé ne peut
    consulter que ses propres ventes réalisées aujourd'hui et les six jours
    précédents (sept jours calendaires au total).
    """
    if user_is_admin(user):
        return queryset

    start_date = timezone.localdate() - timedelta(days=EMPLOYEE_SALES_HISTORY_DAYS - 1)
    return queryset.filter(created_by=user, sale_date__date__gte=start_date)
