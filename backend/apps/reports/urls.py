from django.urls import path
from . import views
from . import export_views
from . import invoice_views

urlpatterns = [
    # Dashboard KPIs
    path('dashboard/', views.DashboardKPIView.as_view(), name='dashboard-kpi'),
    path('dashboard/recent-sales/', views.RecentSalesView.as_view(), name='recent-sales'),

    # Graphiques
    path('charts/daily/', views.SalesChartView.as_view(), name='sales-chart-daily'),
    path('charts/monthly/', views.MonthlySalesChartView.as_view(), name='sales-chart-monthly'),
    path('charts/categories/', views.CategorySalesView.as_view(), name='category-sales'),

    # Stats
    path('top-products/', views.TopProductsView.as_view(), name='top-products'),

    # Exports Excel
    path('export/sales/', export_views.ExportSalesView.as_view(), name='export-sales'),
    path('export/products/', export_views.ExportProductsView.as_view(), name='export-products'),
    path('export/movements/', export_views.ExportMovementsView.as_view(), name='export-movements'),

    # Factures PDF (WeasyPrint)
    path('invoice/<int:pk>/pdf/', invoice_views.InvoicePDFView.as_view(), name='invoice-pdf'),
    path('invoice/<int:pk>/pdf/regen/', invoice_views.InvoicePDFRegenerateView.as_view(), name='invoice-pdf-regen'),
]
