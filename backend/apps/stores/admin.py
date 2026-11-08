from django.contrib import admin
from .models import Store

@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_active', 'order', 'created_at']
    list_editable = ['is_active', 'order']
    prepopulated_fields = {'slug': ('name',)}
