#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bootstrap/qa.sh [--evidence-dir DIR]

Dual AGS QA gate:
1) Runtime QA (mandatory)
2) Visual/UX QA (mandatory)

Approval only when both gates pass.
EOF
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_QA_SCRIPT="$REPO_DIR/bootstrap/qa-runtime.sh"
VISUAL_QA_SCRIPT="$REPO_DIR/bootstrap/qa-visual.sh"

timestamp="$(date +%Y%m%d-%H%M%S)"
evidence_dir="/tmp/ags-qa/$timestamp"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --evidence-dir)
      if [[ $# -lt 2 ]]; then
        echo "[qa] FAIL: missing value for --evidence-dir" >&2
        exit 2
      fi
      evidence_dir="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "[qa] FAIL: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

mkdir -p "$evidence_dir"

runtime_stdout="$evidence_dir/runtime.stdout.log"
visual_stdout="$evidence_dir/visual.stdout.log"
report_file="$evidence_dir/qa-report.txt"
combined_failures_file="$evidence_dir/qa.failures"

log() {
  echo "[qa] $*"
}

severity_rank() {
  case "$1" in
    P0) echo 0 ;;
    P1) echo 1 ;;
    P2) echo 2 ;;
    *) echo 9 ;;
  esac
}

fix_for_failure_code() {
  case "$1" in
    smoke-fail)
      echo "Revisar runtime.smoke.log y corregir el flujo que rompe bootstrap/ags-smoke.sh."
      ;;
    service-inactive | service-inactive-post | service-failed | service-unstable)
      echo "Estabilizar ags.service (unidad, dependencias y startup) hasta mantener estado active."
      ;;
    restart-loop | restart-anomaly)
      echo "Reducir crash-loop: corregir excepción inicial y validar que NRestarts quede estable."
      ;;
    runtime-critical | sass-critical)
      echo "Corregir errores JS/Sass detectados en logs antes de aprobar."
      ;;
    forbidden-runtime-strings | forbidden-activewindow-strings | forbidden-static-labels)
      echo "Sanitizar labels dinámicos/estáticos para bloquear strings técnicos ([object/undefined/null/native@)."
      ;;
    layout-min-width-guards | layout-active-window-truncation | layout-spotify-chip-truncation)
      echo "Aplicar guardas de contención (min-width:0 + truncación consistente) para evitar overflow/clipping."
      ;;
    hierarchy-max-visible-blocks | hierarchy-grouped-secondary-metrics | hierarchy-single-focus-source)
      echo "Reordenar composición del bar para mantener <=6 bloques y foco primario único."
      ;;
    popup-priority-policy | popup-dynamic-offset-policy | popup-multi-monitor-binding)
      echo "Corregir orquestación de overlays (prioridad, offsets dinámicos y binding por monitor)."
      ;;
    legibility-dark-contrast | legibility-min-font-size)
      echo "Ajustar tokens de contraste/tipografía para cumplir legibilidad mínima."
      ;;
    missing-hyprctl)
      echo "Instalar o exponer hyprctl en PATH para validar metadata visual de ventana activa."
      ;;
    *)
      echo "Investigar el fallo y aplicar fix en el módulo afectado antes de aprobar."
      ;;
  esac
}

run_gate() {
  local gate_name="$1"
  local script_path="$2"
  local stdout_path="$3"

  log "running $gate_name"
  if bash "$script_path" --evidence-dir "$evidence_dir" | tee "$stdout_path"; then
    log "$gate_name PASS"
    return 0
  fi

  log "$gate_name FAIL"
  return 1
}

if [[ ! -x "$RUNTIME_QA_SCRIPT" ]]; then
  log "FAIL: missing executable $RUNTIME_QA_SCRIPT"
  exit 1
fi

if [[ ! -x "$VISUAL_QA_SCRIPT" ]]; then
  log "FAIL: missing executable $VISUAL_QA_SCRIPT"
  exit 1
fi

runtime_ok=true
visual_ok=true

if ! run_gate "runtime-qa" "$RUNTIME_QA_SCRIPT" "$runtime_stdout"; then
  runtime_ok=false
fi

if ! run_gate "visual-qa" "$VISUAL_QA_SCRIPT" "$visual_stdout"; then
  visual_ok=false
fi

runtime_summary_file="$evidence_dir/runtime/runtime.summary"
runtime_failures_file="$evidence_dir/runtime/runtime.failures"
visual_summary_file="$evidence_dir/visual/visual.summary"
visual_failures_file="$evidence_dir/visual/visual.failures"

: >"$combined_failures_file"
[[ -s "$runtime_failures_file" ]] && cat "$runtime_failures_file" >>"$combined_failures_file" || true
[[ -s "$visual_failures_file" ]] && cat "$visual_failures_file" >>"$combined_failures_file" || true

sorted_failures="$(
  if [[ -s "$combined_failures_file" ]]; then
    while IFS='|' read -r severity code message; do
      [[ -z "${severity:-}" ]] && continue
      rank="$(severity_rank "$severity")"
      printf '%s|%s|%s|%s\n' "$rank" "$severity" "$code" "$message"
    done <"$combined_failures_file" | sort -t'|' -k1,1n
  fi
)"

final_status="PASS"
if [[ "$runtime_ok" != true || "$visual_ok" != true ]]; then
  final_status="FAIL"
fi

{
  echo "Dual QA Report"
  echo "timestamp=$(date '+%F %T')"
  echo "evidence_dir=$evidence_dir"
  echo
  echo "[runtime]"
  if [[ -f "$runtime_summary_file" ]]; then
    cat "$runtime_summary_file"
  else
    echo "summary_missing=true"
  fi
  echo
  echo "[visual]"
  if [[ -f "$visual_summary_file" ]]; then
    cat "$visual_summary_file"
  else
    echo "summary_missing=true"
  fi
  echo
  echo "[failures]"
  if [[ -n "$sorted_failures" ]]; then
    while IFS='|' read -r _rank severity code message; do
      [[ -z "${severity:-}" ]] && continue
      fix="$(fix_for_failure_code "$code")"
      echo "$severity|$code|$message|fix=$fix"
    done <<<"$sorted_failures"
  else
    echo "none"
  fi
  echo
  echo "final_status=$final_status"
} >"$report_file"

log "runtime summary:"
if [[ -f "$runtime_summary_file" ]]; then
  sed 's/^/[qa]   /' "$runtime_summary_file"
else
  log "  summary missing: $runtime_summary_file"
fi

log "visual summary:"
if [[ -f "$visual_summary_file" ]]; then
  sed 's/^/[qa]   /' "$visual_summary_file"
else
  log "  summary missing: $visual_summary_file"
fi

if [[ -n "$sorted_failures" ]]; then
  log "detected failures:"
  while IFS='|' read -r _rank severity code message; do
    [[ -z "${severity:-}" ]] && continue
    log "  $severity $code: $message"
    log "    fix: $(fix_for_failure_code "$code")"
  done <<<"$sorted_failures"
else
  log "detected failures: none"
fi

log "final status: $final_status"
log "report: $report_file"

if [[ "$final_status" == "PASS" ]]; then
  exit 0
fi
exit 1
