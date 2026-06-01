from django.urls import path
from . import views

urlpatterns = [
    # Catégories
    path('categories/', views.CategoryListCreateView.as_view(), name='category-list'),
    path('categories/<int:pk>/', views.CategoryDetailView.as_view(), name='category-detail'),

    # Sous-catégories
    path('subcategories/', views.SubCategoryListCreateView.as_view(), name='subcategory-list'),
    path('subcategories/<int:pk>/', views.SubCategoryDetailView.as_view(), name='subcategory-detail'),

    # Fournisseurs
    path('suppliers/', views.SupplierListCreateView.as_view(), name='supplier-list'),
    path('suppliers/<int:pk>/', views.SupplierDetailView.as_view(), name='supplier-detail'),

    # Produits
    path('products/', views.ProductListCreateView.as_view(), name='product-list'),
    path('products/<int:pk>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('products/low-stock/', views.ProductLowStockView.as_view(), name='product-low-stock'),
    path('products/search/', views.ProductSearchView.as_view(), name='product-search'),
]
