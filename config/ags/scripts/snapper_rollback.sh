#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: config/ags/scripts/snapper_rollback.sh

Interactive rollback helper for Snapper root config.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v snapper >/dev/null 2>&1; then
  echo "[abort] snapper no está instalado."
  echo
  read -r -p "Enter para cerrar" _ || true
  exit 1
fi

if ! snapper list-configs 2>/dev/null | awk '{print $1}' | grep -qx root; then
  echo "[abort] No existe configuración snapper 'root'."
  echo
  read -r -p "Enter para cerrar" _ || true
  exit 1
fi

echo "[rollback] Snapper root detectado"
echo "[warning] Esta operación modifica el estado del sistema y normalmente requiere reinicio."
echo

sudo snapper -c root list || {
  echo "[abort] No se pudo listar snapshots de root."
  echo
  read -r -p "Enter para cerrar" _ || true
  exit 1
}

echo
read -r -p "ID de snapshot para rollback: " snapshot_id
if [[ ! "$snapshot_id" =~ ^[0-9]+$ ]]; then
  echo "[abort] ID inválido. Debe ser numérico."
  echo
  read -r -p "Enter para cerrar" _ || true
  exit 1
fi

echo
read -r -p "Confirma rollback al snapshot ${snapshot_id} escribiendo YES: " confirm
if [[ "$confirm" != "YES" ]]; then
  echo "[abort] Operación cancelada."
  echo
  read -r -p "Enter para cerrar" _ || true
  exit 1
fi

echo
if sudo snapper -c root rollback "$snapshot_id"; then
  echo "[result] Rollback aplicado. Reinicia el sistema para completar la recuperación."
else
  echo "[result] Falló el rollback."
  echo
  read -r -p "Enter para cerrar" _ || true
  exit 1
fi

echo
read -r -p "Enter para cerrar" _ || true
