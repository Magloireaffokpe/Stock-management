"""
Commande : python manage.py auto_backup
Copie db.sqlite3 dans /backup/ — à appeler via cron ou scheduler.
"""
import shutil
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Sauvegarde automatique de la base de données SQLite'

    def handle(self, *args, **options):
        db_path = settings.DB_PATH
        if not db_path.exists():
            self.stderr.write(f'{db_path} introuvable')
            return

        backup_dir = settings.BACKUP_DIR
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        dest = backup_dir / f'auto_{timestamp}.sqlite3'
        shutil.copy2(db_path, dest)

        # Garder seulement les 20 dernières
        all_backups = sorted(backup_dir.glob('*.sqlite3'), key=lambda f: f.stat().st_mtime, reverse=True)
        for old in all_backups[20:]:
            old.unlink()

        self.stdout.write(self.style.SUCCESS(f'Sauvegarde créée : {dest.name}'))
