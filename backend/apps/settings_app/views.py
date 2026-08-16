import os
import shutil
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, IsAdminUser


class IsAdminRole(IsAuthenticated):
    """Allow only admin-role users to access sensitive settings and audit endpoints."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return (
            request.user.is_staff
            or request.user.is_superuser
            or getattr(request.user, "role", "") == "admin"
        )


from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StoreSettings
from .serializers import StoreSettingsSerializer


class StoreSettingsView(APIView):
    """GET / PATCH du singleton paramètres magasin"""

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAdminRole()]

    def get(self, request):
        instance = StoreSettings.get()
        serializer = StoreSettingsSerializer(instance, context={"request": request})
        return Response(serializer.data)

    def patch(self, request):
        instance = StoreSettings.get()
        serializer = StoreSettingsSerializer(
            instance, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DatabaseExportView(APIView):
    """Télécharge db.sqlite3 — admin seulement"""

    permission_classes = [IsAdminRole]

    def get(self, request):
        db_path = settings.DB_PATH
        if not db_path.exists():
            raise Http404("Base de données introuvable")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"micrologis_backup_{timestamp}.sqlite3"
        response = FileResponse(
            open(db_path, "rb"), content_type="application/octet-stream"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class DatabaseRestoreView(APIView):
    """Restaure une sauvegarde db.sqlite3 — admin seulement"""

    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded = request.FILES.get("database")
        if not uploaded:
            return Response(
                {"error": "Fichier manquant"}, status=status.HTTP_400_BAD_REQUEST
            )

        db_path = settings.DB_PATH
        backup_dir = settings.BACKUP_DIR
        backup_dir.mkdir(exist_ok=True)

        # Sauvegarde l'ancienne BDD avant de remplacer
        if db_path.exists():
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            shutil.copy2(db_path, backup_dir / f"pre_restore_{timestamp}.sqlite3")

        # Écriture de la nouvelle BDD
        with open(db_path, "wb") as f:
            for chunk in uploaded.chunks():
                f.write(chunk)

        return Response(
            {"message": "Base de données restaurée avec succès. Relancez le serveur."}
        )


class BackupListView(APIView):
    """Liste les 10 dernières sauvegardes auto"""

    permission_classes = [IsAdminRole]

    def get(self, request):
        backup_dir = settings.BACKUP_DIR
        if not backup_dir.exists():
            return Response([])
        files = sorted(
            backup_dir.glob("*.sqlite3"), key=os.path.getmtime, reverse=True
        )[:10]
        data = [
            {
                "filename": f.name,
                "size_kb": round(f.stat().st_size / 1024, 1),
                "created_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            }
            for f in files
        ]
        return Response(data)


class ManualBackupView(APIView):
    """Déclenche une sauvegarde manuelle dans /backup/"""

    permission_classes = [IsAdminRole]

    def post(self, request):
        db_path = settings.DB_PATH
        if not db_path.exists():
            return Response({"error": "BDD introuvable"}, status=404)

        backup_dir = settings.BACKUP_DIR
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest = backup_dir / f"manual_{timestamp}.sqlite3"
        shutil.copy2(db_path, dest)

        # Garder seulement les 20 dernières sauvegardes
        all_backups = sorted(
            backup_dir.glob("*.sqlite3"), key=os.path.getmtime, reverse=True
        )
        for old in all_backups[20:]:
            old.unlink()

        return Response({"message": f"Sauvegarde créée : {dest.name}"})


from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class AuditLogListView(ListAPIView):
    """
    Liste les journaux d'audit (Admin seulement).
    Filtrable par action_type, user_id, date.
    """

    permission_classes = [IsAdminRole]
    serializer_class = AuditLogSerializer
    pagination_class = AuditLogPagination

    def get_queryset(self):
        qs = AuditLog.objects.select_related("user").all()

        action_type = self.request.query_params.get("action_type")
        user_id = self.request.query_params.get("user_id")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        search = self.request.query_params.get("search")

        if action_type:
            qs = qs.filter(action_type=action_type)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        if search:
            qs = qs.filter(description__icontains=search)

        return qs
