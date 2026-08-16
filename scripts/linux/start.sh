#!/usr/bin/env bash
# MICROLOGIS Stock Manager — Démarrage (Linux / macOS)
set -euo pipefail

cd "$(dirname "$0")/../.."

echo
echo "======================================================="
echo "   MICROLOGIS STOCK MANAGER - DEMARRAGE"
echo "======================================================="
echo

if ! docker info >/dev/null 2>&1; then
  echo "  [ERREUR] Docker n'est pas installe ou n'est pas demarre."
  echo "  Demarrez Docker puis relancez ce script."
  exit 1
fi

COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  else
    echo "  [ERREUR] Docker Compose n'est pas installe."
    exit 1
  fi
fi

for d in data media factures backup staticfiles; do
  mkdir -p "backend/$d"
done

echo "  Demarrage de l'application..."
$COMPOSE up -d

echo "  Attente du demarrage (quelques secondes)..."
for _ in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost/; then
    READY=1
    break
  fi
  sleep 2
done

echo
echo "======================================================="
echo "   MICROLOGIS EST PRET !"
echo "======================================================="
echo
echo "   Application    : http://localhost"
echo "   Administration : http://localhost/admin/"
echo
echo "   Connectez-vous avec le compte administrateur"
echo "   qui vous a ete communique."
echo
echo "   Vos donnees sont conservees dans le dossier backend/data"
echo

if [ "${READY:-}" != "1" ]; then
  echo "  [ATTENTION] L'application ne repond pas encore."
  echo "  Verifiez l'etat avec : $COMPOSE ps"
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open http://localhost >/dev/null 2>&1 || true
fi

exit 0
