from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', views.MeView.as_view(), name='me'),
    path('users/', views.UserListCreateView.as_view(), name='users-list'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('activity/', views.ActivityLogView.as_view(), name='activity-log'),
]
