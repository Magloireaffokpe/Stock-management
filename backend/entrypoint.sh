#!/bin/bash

# Identifiants admin configurables (variables d'environnement), défauts sûrs
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@micrologis.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-micrologis2026}"

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if not exists
echo "Ensuring admin user exists..."
ADMIN_USERNAME="$ADMIN_USERNAME" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" python manage.py shell -c "
from django.contrib.auth import get_user_model;
import os;
User = get_user_model();
username = os.environ['ADMIN_USERNAME'];
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(
        username=username,
        email=os.environ['ADMIN_EMAIL'],
        password=os.environ['ADMIN_PASSWORD'],
        role='admin',
        first_name='Admin',
        last_name='MICROLOGIS'
    )
    print(f\"Compte admin '{username}' créé.\")
else:
    print(f\"Le compte admin '{username}' existe déjà — inchangé.\")
"

# Start ASGI server (Daphne) for both HTTP and WebSockets
echo "Starting Daphne server..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
