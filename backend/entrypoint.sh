#!/bin/bash

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if not exists
echo "Ensuring admin user exists..."
python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser(
        username='admin',
        email='admin@micrologis.local',
        password='micrologis2026',
        role='admin',
        first_name='Admin',
        last_name='MICROLOGIS'
    )
"

# Start ASGI server (Daphne) for both HTTP and WebSockets
echo "Starting Daphne server..."
daphne -b 0.0.0.0 -p 8000 config.asgi:application
