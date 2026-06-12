import os
import sys
from datetime import date
from django.apps import AppConfig


class SettingsAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.settings_app'
    verbose_name = 'Paramètres'

    def ready(self):
        # Éviter l'exécution double en mode développement
        if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
            return
            
        # Ne pas exécuter pendant les autres commandes manage.py (migrations, tests...)
        if 'manage.py' in sys.argv and 'runserver' not in sys.argv:
            return

        from django.conf import settings
        from django.core.management import call_command
        
        try:
            backup_dir = settings.BACKUP_DIR
            backup_dir.mkdir(exist_ok=True)
            last_backup_file = backup_dir / 'last_backup.txt'
            today_str = date.today().isoformat()
            
            should_run = True
            if last_backup_file.exists():
                with open(last_backup_file, 'r', encoding='utf-8') as f:
                    if f.read().strip() == today_str:
                        should_run = False
                        
            if should_run:
                print(f"Exécution de la sauvegarde quotidienne automatique ({today_str})...")
                call_command('auto_backup')
                with open(last_backup_file, 'w', encoding='utf-8') as f:
                    f.write(today_str)
        except Exception as e:
            print(f"Erreur lors de la sauvegarde quotidienne : {e}")
