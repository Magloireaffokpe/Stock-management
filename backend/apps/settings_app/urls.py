from django.urls import path
from . import views

urlpatterns = [
    path('', views.StoreSettingsView.as_view(), name='store-settings'),
    path('backup/export/', views.DatabaseExportView.as_view(), name='db-export'),
    path('backup/restore/', views.DatabaseRestoreView.as_view(), name='db-restore'),
    path('backup/list/', views.BackupListView.as_view(), name='backup-list'),
    path('backup/manual/', views.ManualBackupView.as_view(), name='manual-backup'),
    path('audit/', views.AuditLogListView.as_view(), name='audit-log-list'),
]
