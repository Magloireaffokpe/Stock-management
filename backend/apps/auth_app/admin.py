from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, ActivityLog

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'first_name', 'last_name', 'role', 'is_active', 'last_login']
    list_filter  = ['role', 'is_active']
    fieldsets    = UserAdmin.fieldsets + (
        ('Rôle MICROLOGIS', {'fields': ('role', 'phone')}),
    )

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display  = ['user', 'action', 'description', 'ip_address', 'created_at']
    list_filter   = ['action', 'created_at']
    search_fields = ['user__username', 'description']
    readonly_fields = ['user', 'action', 'description', 'ip_address', 'created_at']
