from django.urls import path
from . import views
from .pdf_views import InvoicePDFView

urlpatterns = [
    # Clients
    path('clients/', views.ClientListCreateView.as_view(), name='client-list'),
    path('clients/<int:pk>/', views.ClientDetailView.as_view(), name='client-detail'),

    # Ventes
    path('sales/', views.SaleListView.as_view(), name='sale-list'),
    path('sales/create/', views.SaleCreateView.as_view(), name='sale-create'),
    path('sales/<int:pk>/', views.SaleDetailView.as_view(), name='sale-detail'),
    path('sales/<int:pk>/cancel/', views.SaleCancelView.as_view(), name='sale-cancel'),

    # Devis
    path('quotations/', views.QuotationListCreateView.as_view(), name='quotation-list'),
    path('quotations/<int:pk>/', views.QuotationDetailView.as_view(), name='quotation-detail'),
    path('quotations/<int:pk>/convert/', views.QuotationConvertView.as_view(), name='quotation-convert'),

    # Réapprovisionnements
    path('restocks/', views.RestockListView.as_view(), name='restock-list'),
    path('restocks/create/', views.RestockCreateView.as_view(), name='restock-create'),
    path('restocks/<int:pk>/', views.RestockDetailView.as_view(), name='restock-detail'),

    # PDF factures
    path('sales/<int:pk>/pdf/', InvoicePDFView.as_view(), name='sale-pdf'),
]
