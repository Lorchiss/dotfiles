#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash bootstrap/bar-diagnose.sh [--logs N]

Diagnóstico incremental de la barra AGS:
1) Arranca con todos los módulos OFF.
2) Activa módulos uno a uno (acumulativo).
3) Revisa logs y reporta el primer módulo sospechoso.

Variables usadas por módulo:
  BAR_WS BAR_ACTIVE_WINDOW BAR_SPOTIFY BAR_HEALTH
  BAR_MAINTENANCE BAR_CLOCK BAR_AUDIO BAR_CONNECTIVITY
  DEBUG_BAR=1 durante el diagnóstico
EOF
}

MODULES=(
  WS
  ACTIVE_WINDOW
  SPOTIFY
  HEALTH
  MAINTENANCE
  CLOCK
  AUDIO
  CONNECTIVITY
)

LOG_LINES=300

while [[ $# -gt 0 ]]; do
  case "$1" in
    --logs)
      if [[ $# -lt 2 ]]; then
        echo "[bar-diagnose] FAIL: missing value for --logs" >&2
        exit 2
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]] || (( "$2" <= 0 )); then
        echo "[bar-diagnose] FAIL: --logs requires a positive integer" >&2
        exit 2
      fi
      LOG_LINES="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "[bar-diagnose] FAIL: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

PROHIBITED_PATTERNS=(
  "No property named"
  "assertion failed"
  "instance wrapper"
  "[object"
  "TypeError"
  "Traceback"
  "CRITICAL"
)

set_bar_env() {
  local -a enabled_modules=("$@")

  systemctl --user set-environment DEBUG_BAR=1
  systemctl --user set-environment BAR_WS=0
  systemctl --user set-environment BAR_ACTIVE_WINDOW=0
  systemctl --user set-environment BAR_SPOTIFY=0
  systemctl --user set-environment BAR_HEALTH=0
  systemctl --user set-environment BAR_MAINTENANCE=0
  systemctl --user set-environment BAR_CLOCK=0
  systemctl --user set-environment BAR_AUDIO=0
  systemctl --user set-environment BAR_CONNECTIVITY=0

  for module in "${enabled_modules[@]}"; do
    systemctl --user set-environment "BAR_${module}=1"
  done
}

cleanup_env() {
  systemctl --user unset-environment \
    DEBUG_BAR \
    BAR_WS \
    BAR_ACTIVE_WINDOW \
    BAR_SPOTIFY \
    BAR_HEALTH \
    BAR_MAINTENANCE \
    BAR_CLOCK \
    BAR_AUDIO \
    BAR_CONNECTIVITY \
    BAR_SIMULATE_INVALID_TEXT || true
}

trap cleanup_env EXIT

run_case() {
  local case_name="$1"
  shift
  local -a enabled_modules=("$@")

  echo "[bar-diagnose] case=$case_name enabled=${enabled_modules[*]:-none}"
  set_bar_env "${enabled_modules[@]}"

  systemctl --user reset-failed ags.service >/dev/null 2>&1 || true
  systemctl --user restart ags.service
  sleep 3

  local log_file
  log_file="/tmp/bar-diagnose-${case_name}.log"

  if ! systemctl --user is-active --quiet ags.service; then
    echo "[bar-diagnose] case=$case_name FAIL service_inactive"
    return 1
  fi

  local invocation_id
  invocation_id="$(systemctl --user show -p InvocationID --value ags.service | tr -d ' ')"
  if [[ -n "$invocation_id" && "$invocation_id" != "0" ]]; then
    journalctl --user _SYSTEMD_INVOCATION_ID="$invocation_id" -n "$LOG_LINES" --no-pager >"$log_file"
  else
    local main_pid
    main_pid="$(systemctl --user show -p MainPID --value ags.service | tr -d ' ')"
    if [[ -z "$main_pid" || "$main_pid" == "0" ]]; then
      echo "[bar-diagnose] case=$case_name FAIL missing_main_pid"
      return 1
    fi
    journalctl --user _PID="$main_pid" -n "$LOG_LINES" --no-pager >"$log_file"
  fi

  local failed_pattern=""
  for pattern in "${PROHIBITED_PATTERNS[@]}"; do
    if rg -qiF "$pattern" "$log_file"; then
      failed_pattern="$pattern"
      break
    fi
  done

  if [[ -n "$failed_pattern" ]]; then
    echo "[bar-diagnose] case=$case_name FAIL pattern=$failed_pattern"
    rg -niF "$failed_pattern" "$log_file" | sed 's/^/[bar-diagnose]   /' || true
    return 1
  fi

  for module in "${enabled_modules[@]}"; do
    if ! rg -q "\\[BAR:${module}\\]" "$log_file"; then
      echo "[bar-diagnose] case=$case_name FAIL missing_debug_prefix=[BAR:${module}]"
      return 1
    fi
  done

  echo "[bar-diagnose] case=$case_name PASS"
  return 0
}

declare -A MODULE_RESULT=()
suspect_module=""

if ! run_case "all_off"; then
  suspect_module="BASELINE"
fi

enabled=()
for module in "${MODULES[@]}"; do
  enabled+=("$module")
  if run_case "inc_${module}" "${enabled[@]}"; then
    MODULE_RESULT["$module"]="PASS"
  else
    MODULE_RESULT["$module"]="FAIL"
    if [[ -z "$suspect_module" ]]; then
      suspect_module="$module"
    fi
  fi
done

echo "[bar-diagnose] summary:"
for module in "${MODULES[@]}"; do
  result="${MODULE_RESULT[$module]:-PASS}"
  echo "[bar-diagnose]   $module=$result"
done

if [[ -n "$suspect_module" ]]; then
  echo "[bar-diagnose] suspect_module=$suspect_module"
  exit 1
fi

echo "[bar-diagnose] suspect_module=none"
echo "[bar-diagnose] PASS"
exit 0
