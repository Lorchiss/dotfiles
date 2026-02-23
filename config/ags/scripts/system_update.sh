#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: config/ags/scripts/system_update.sh [--dry-run] [--no-snapshot]

Options:
  --dry-run      Print actions without running package updates.
  --no-snapshot  Skip Snapper pre/post snapshots.
  -h, --help     Show this help.
USAGE
}

lock_dir="/tmp/ags-system-update.lock"
dry_run=0
no_snapshot=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=1
      ;;
    --no-snapshot)
      no_snapshot=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[error] Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "[abort] Ya hay una actualización en progreso (${lock_dir})."
  echo
  read -r -p "Enter para cerrar" _ || true
  exit 1
fi
trap 'rmdir "$lock_dir" >/dev/null 2>&1 || true' EXIT

have_snapper_root() {
  command -v snapper >/dev/null 2>&1 || return 1
  snapper list-configs 2>/dev/null | awk '{print $1}' | grep -qx root
}

create_snapshot() {
  local phase="$1"
  local result="$2"
  local description
  description="ags-maintenance:${phase}:${result}:$(date '+%F %T')"

  if [[ "$dry_run" -eq 1 ]]; then
    echo "[dry-run] sudo snapper -c root create --description \"${description}\" --cleanup-algorithm number --print-number"
    return 0
  fi

  local output
  if output=$(sudo snapper -c root create --description "$description" --cleanup-algorithm number --print-number 2>&1); then
    local id
    id=$(echo "$output" | awk 'NF{line=$0} END{print line}' | tr -cd '0-9')
    if [[ -n "$id" ]]; then
      echo "[snapper] ${phase} snapshot id=${id}"
    else
      echo "[snapper] ${phase} snapshot creado"
    fi
    return 0
  fi

  echo "[warn] No se pudo crear snapshot ${phase}"
  echo "$output"
  return 1
}

echo "[maintenance] Arch update flow"
[[ "$dry_run" -eq 1 ]] && echo "[mode] dry-run"

snapper_enabled=0
if [[ "$no_snapshot" -eq 1 ]]; then
  echo "[snapper] deshabilitado por flag --no-snapshot"
elif have_snapper_root; then
  snapper_enabled=1
  echo "[snapper] configuración root detectada"
else
  echo "[snapper] no disponible (se continúa sin snapshots)"
fi

if [[ "$snapper_enabled" -eq 1 ]]; then
  create_snapshot "pre" "pending" || true
fi

pacman_status=0
paru_status=0

if [[ "$dry_run" -eq 1 ]]; then
  echo "[dry-run] sudo pacman -Syu"
else
  echo "[step] sudo pacman -Syu"
  set +e
  sudo pacman -Syu
  pacman_status=$?
  set -e
fi

if [[ "$pacman_status" -eq 0 ]]; then
  if command -v paru >/dev/null 2>&1; then
    if [[ "$dry_run" -eq 1 ]]; then
      echo "[dry-run] paru -Sua"
    else
      echo "[step] paru -Sua"
      set +e
      paru -Sua
      paru_status=$?
      set -e
    fi
  else
    echo "[aur] paru no instalado, se omite AUR"
  fi
else
  echo "[warn] pacman falló; se omite paso AUR"
fi

overall_status=0
if [[ "$pacman_status" -ne 0 ]]; then
  overall_status="$pacman_status"
elif [[ "$paru_status" -ne 0 ]]; then
  overall_status="$paru_status"
fi

if [[ "$snapper_enabled" -eq 1 ]]; then
  if [[ "$overall_status" -eq 0 ]]; then
    create_snapshot "post" "ok" || true
  else
    create_snapshot "post" "failed" || true
  fi
fi

echo
if [[ "$overall_status" -eq 0 ]]; then
  echo "[result] OK: actualización finalizada"
else
  echo "[result] FAIL: pacman=${pacman_status} | paru=${paru_status}"
fi

echo
read -r -p "Enter para cerrar" _ || true
exit "$overall_status"
