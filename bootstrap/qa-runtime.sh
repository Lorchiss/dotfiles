#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bootstrap/qa-runtime.sh [--evidence-dir DIR]

Runtime QA gate for AGS:
- verifies ags.service is active and stable
- runs bootstrap/ags-smoke.sh
- scans recent ags logs for critical runtime and Sass/compilation errors
EOF
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_SCRIPT="$REPO_DIR/bootstrap/ags-smoke.sh"
SERVICE_NAME="ags.service"
SERVICE_UNIT="--user -u $SERVICE_NAME"

timestamp="$(date +%Y%m%d-%H%M%S)"
evidence_dir="/tmp/ags-qa/$timestamp/runtime"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --evidence-dir)
      if [[ $# -lt 2 ]]; then
        echo "[runtime-qa] FAIL: missing value for --evidence-dir" >&2
        exit 2
      fi
      evidence_dir="$2/runtime"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "[runtime-qa] FAIL: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

mkdir -p "$evidence_dir"

summary_file="$evidence_dir/runtime.summary"
failures_file="$evidence_dir/runtime.failures"
journal_file="$evidence_dir/runtime.journal.log"
critical_file="$evidence_dir/runtime.critical.log"
restart_file="$evidence_dir/runtime.restart-anomaly.log"
smoke_output_file="$evidence_dir/runtime.smoke.log"

critical_patterns='JS ERROR|TypeError|Traceback|CRITICAL|Unhandled promise rejection'
sass_patterns='SassError|Can'\''t find stylesheet|Undefined variable|Undefined mixin|Invalid CSS after|Error: expected'
restart_patterns='start-limit-hit|Start request repeated too quickly|Main process exited|Failed with result'

script_start_human="$(date '+%F %T')"
runtime_pass=true
smoke_pass=false
service_active=false
service_failed=false
service_stable=true
critical_hits=0
sass_hits=0
restart_hits=0
restart_delta=0

declare -a failures=()

log() {
  echo "[runtime-qa] $*"
}

add_failure() {
  local severity="$1"
  local code="$2"
  local message="$3"
  runtime_pass=false
  failures+=("$severity|$code|$message")
}

read_nrestarts() {
  systemctl --user show "$SERVICE_NAME" --property=NRestarts --value 2>/dev/null \
    | tr -d '[:space:]'
}

number_or_zero() {
  local value="$1"
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "$value"
    return
  fi
  echo "0"
}

log "evidence dir: $evidence_dir"

if ! command -v systemctl >/dev/null 2>&1; then
  add_failure "P0" "systemctl-missing" "systemctl no está disponible"
fi

if [[ ! -x "$SMOKE_SCRIPT" ]]; then
  add_failure "P0" "smoke-missing" "No existe script ejecutable: $SMOKE_SCRIPT"
fi

restart_before="$(number_or_zero "$(read_nrestarts)")"

if systemctl --user is-active --quiet "$SERVICE_NAME"; then
  service_active=true
else
  add_failure "P0" "service-inactive" "$SERVICE_NAME no está activo antes de smoke"
fi

if [[ "$runtime_pass" == true ]]; then
  log "running smoke: bootstrap/ags-smoke.sh"
  if bash "$SMOKE_SCRIPT" >"$smoke_output_file" 2>&1; then
    smoke_pass=true
  else
    add_failure "P0" "smoke-fail" "bootstrap/ags-smoke.sh falló (ver runtime.smoke.log)"
  fi
fi

if systemctl --user is-failed --quiet "$SERVICE_NAME"; then
  service_failed=true
  add_failure "P0" "service-failed" "$SERVICE_NAME quedó en estado failed"
fi

if ! systemctl --user is-active --quiet "$SERVICE_NAME"; then
  service_active=false
  add_failure "P0" "service-inactive-post" "$SERVICE_NAME no está activo después de smoke"
fi

baseline_restart="$(number_or_zero "$(read_nrestarts)")"
for _ in 1 2 3 4; do
  sleep 1
  if ! systemctl --user is-active --quiet "$SERVICE_NAME"; then
    service_stable=false
    add_failure "P0" "service-unstable" "$SERVICE_NAME perdió estado active durante ventana de estabilidad"
    break
  fi
done
final_restart="$(number_or_zero "$(read_nrestarts)")"
restart_delta="$((final_restart - baseline_restart))"
if (( restart_delta > 0 )); then
  add_failure \
    "P0" \
    "restart-loop" \
    "$SERVICE_NAME reinició $restart_delta vez/veces sin intervención durante ventana de estabilidad"
fi

journalctl --user -u "$SERVICE_NAME" --since "$script_start_human" --no-pager \
  >"$journal_file" || true

if grep -Ein "$critical_patterns" "$journal_file" >"$critical_file"; then
  critical_hits="$(wc -l <"$critical_file" | tr -d '[:space:]')"
  add_failure "P0" "runtime-critical" "Errores críticos runtime detectados en logs ($critical_hits hits)"
fi

if grep -Ein "$sass_patterns" "$journal_file" >"$evidence_dir/runtime.sass.log"; then
  sass_hits="$(wc -l <"$evidence_dir/runtime.sass.log" | tr -d '[:space:]')"
  add_failure "P0" "sass-critical" "Errores Sass/compilación detectados ($sass_hits hits)"
fi

if grep -Ein "$restart_patterns" "$journal_file" >"$restart_file"; then
  restart_hits="$(wc -l <"$restart_file" | tr -d '[:space:]')"
  add_failure \
    "P0" \
    "restart-anomaly" \
    "Anomalías de crash/restart detectadas en logs ($restart_hits hits)"
fi

{
  echo "runtime_pass=$runtime_pass"
  echo "service_active=$service_active"
  echo "service_failed=$service_failed"
  echo "service_stable=$service_stable"
  echo "smoke_pass=$smoke_pass"
  echo "critical_hits=$critical_hits"
  echo "sass_hits=$sass_hits"
  echo "restart_hits=$restart_hits"
  echo "restart_before=$restart_before"
  echo "restart_after=$final_restart"
  echo "restart_delta=$restart_delta"
  echo "journal_file=$journal_file"
  echo "smoke_output_file=$smoke_output_file"
} >"$summary_file"

: >"$failures_file"
if [[ "${#failures[@]}" -gt 0 ]]; then
  printf '%s\n' "${failures[@]}" >"$failures_file"
fi

log "runtime summary:"
sed 's/^/[runtime-qa]   /' "$summary_file"

if [[ "$runtime_pass" == true ]]; then
  log "PASS"
  exit 0
fi

log "FAIL"
while IFS='|' read -r severity code message; do
  [[ -z "${severity:-}" ]] && continue
  log "  $severity $code: $message"
done <"$failures_file"
exit 1
