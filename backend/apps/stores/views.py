from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count
from .models import Store
from .serializers import StoreSerializer


class IsAdminOrReadOnly(IsAuthenticated):
    """Admin/superuser = écriture ; tout le monde connecté = lecture seule."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return (
            request.user.is_staff
            or request.user.is_superuser
            or getattr(request.user, "role", "") == "admin"
        )


class StoreViewSet(viewsets.ModelViewSet):
    serializer_class = StoreSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        return (
            Store.objects.annotate(
                product_count=Count("products", distinct=True),
                category_count=Count("categories", distinct=True),
            )
            .order_by("order", "name")
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "La suppression d'une boutique est interdite (405 Method Not Allowed)."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )
