from django.urls import path
from . import views

urlpatterns = [
    # Mouvements
    path('movements/', views.StockMovementListView.as_view(), name='movement-list'),
    path('movements/product/<int:product_id>/', views.ProductMovementsView.as_view(), name='product-movements'),

    # Ajustement manuel
    path('adjust/', views.StockAdjustmentView.as_view(), name='stock-adjust'),

    # Alertes
    path('alerts/', views.StockAlertListView.as_view(), name='alert-list'),
    path('alerts/count/', views.StockAlertCountView.as_view(), name='alert-count'),
    path('alerts/read-all/', views.StockAlertMarkAllReadView.as_view(), name='alert-read-all'),
    path('alerts/<int:pk>/read/', views.StockAlertMarkReadView.as_view(), name='alert-read'),
    path('alerts/<int:pk>/resolve/', views.StockAlertResolveView.as_view(), name='alert-resolve'),
]
