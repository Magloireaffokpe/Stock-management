"""
Commande : python manage.py setup_admin
Crée le compte admin s'il n'existe pas déjà.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Crée le compte administrateur par défaut si absent"

    def add_arguments(self, parser):
        parser.add_argument('--username', default='admin')
        parser.add_argument('--password', default='micrologis2026')
        parser.add_argument('--email', default='admin@micrologis.bj')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        email    = options['email']

        if User.objects.filter(username=username).exists():
            self.stdout.write(f'Compte « {username} » déjà existant — aucune action.')
            return

        user = User.objects.create_superuser(
            username=username,
            password=password,
            email=email,
            role='admin',
            first_name='Admin',
            last_name='MICROLOGIS',
        )
        self.stdout.write(self.style.SUCCESS(
            f'✅ Compte admin créé : {username} / {password}\n'
            f'   ⚠️  Changez ce mot de passe après la première connexion !'
        ))
