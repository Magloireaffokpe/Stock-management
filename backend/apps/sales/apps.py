from django.apps import AppConfig


class SalesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.sales'
    verbose_name = 'Ventes'

    def ready(self):
        """Connecte les signals Django au démarrage"""
        import apps.sales.signals  # noqa
