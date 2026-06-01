from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth JWT
    path('api/auth/', include('apps.auth_app.urls')),

    # Apps métier
    path('api/catalog/', include('apps.catalog.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/stock/', include('apps.stock.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/settings/', include('apps.settings_app.urls')),

    # JWT refresh token direct
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

# Servir les fichiers media en développement
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static('/factures/', document_root=settings.FACTURES_DIR)
