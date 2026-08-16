#!/usr/bin/env bash
# MICROLOGIS Stock Manager — Arrêt (Linux / macOS)
set -euo pipefail

cd "$(dirname "$0")/../.."

echo
echo "======================================================="
echo "   MICROLOGIS STOCK MANAGER - ARRET"
echo "======================================================="
echo

COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  fi
fi

echo "  Arret des conteneurs (vos donnees sont conservees)..."
$COMPOSE down

echo
echo "  Application arretee. Vous pouvez fermer cette fenetre."
echo

exit 0
