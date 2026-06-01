#!/bin/bash
echo ""
echo "  Démarrage de MICROLOGIS Stock Manager..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Démarrer Django
cd "$SCRIPT_DIR/backend"
python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!
echo "  ✓ Backend Django démarré (PID: $BACKEND_PID)"

# Attendre Django
sleep 3

# Démarrer Vite
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "  ✓ Frontend React démarré (PID: $FRONTEND_PID)"

sleep 4

# Ouvrir le navigateur (Linux/Mac)
if command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173
elif command -v open &>/dev/null; then
    open http://localhost:5173
fi

echo ""
echo "  Application sur http://localhost:5173"
echo "  Ctrl+C pour arrêter."
echo ""

# Attendre signal d'arrêt
wait $BACKEND_PID $FRONTEND_PID
