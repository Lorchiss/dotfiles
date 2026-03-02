#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash bootstrap/qa.sh [--strict] [--no-strict] [--logs N]

Strict AGS QA gate (fail-fast, runtime + UX):
1) clean restart of ags.service
2) smoke test (bootstrap/ags-smoke.sh)
3) scan recent ags.service logs for prohibited patterns
4) run UX/static gate (bootstrap/qa-visual.sh) when available

Options:
  --strict      Fail on prohibited log patterns (default).
  --no-strict   Report prohibited log patterns without failing.
  --logs N      Number of journal lines to scan (default: 300).
  --skip-visual Skip bootstrap/qa-visual.sh stage.
  -h, --help    Show this help message.
EOF
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMOKE_SCRIPT="$REPO_DIR/bootstrap/ags-smoke.sh"
VISUAL_QA_SCRIPT="$REPO_DIR/bootstrap/qa-visual.sh"
LOG_LINES=300
STRICT=1
SKIP_VISUAL=0

PROHIBITED_PATTERNS=(
  "No property named"
  "assertion failed"
  "instance wrapper"
  "[object"
  "Accessor"
  "TypeError"
  "Traceback"
  "CRITICAL"
)

log() {
  echo "[qa] $*"
}

is_positive_int() {
  [[ "$1" =~ ^[0-9]+$ ]] && (( "$1" > 0 ))
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      STRICT=1
      shift
      ;;
    --no-strict)
      STRICT=0
      shift
      ;;
    --logs)
      if [[ $# -lt 2 ]]; then
        log "FAIL: missing value for --logs"
        exit 2
      fi
      if ! is_positive_int "$2"; then
        log "FAIL: --logs requires a positive integer"
        exit 2
      fi
      LOG_LINES="$2"
      shift 2
      ;;
    --skip-visual)
      SKIP_VISUAL=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      log "FAIL: unknown argument: $1"
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$SMOKE_SCRIPT" ]]; then
  log "FAIL: missing smoke script $SMOKE_SCRIPT"
  exit 1
fi

since="$(date '+%F %T')"

log "step 1/4: clean restart ags.service"
systemctl --user reset-failed ags.service >/dev/null 2>&1 || true
systemctl --user restart ags.service
sleep 2

if ! systemctl --user is-active --quiet ags.service; then
  log "FAIL: ags.service is not active after restart"
  systemctl --user status ags.service --no-pager -n 60 || true
  exit 1
fi

log "step 2/4: run smoke test"
systemctl --user reset-failed ags.service >/dev/null 2>&1 || true
if ! bash "$SMOKE_SCRIPT"; then
  log "FAIL: bootstrap/ags-smoke.sh"
  exit 1
fi

log "step 3/4: scan ags.service logs (last $LOG_LINES lines)"
log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT
journalctl --user -u ags.service --since "$since" -n "$LOG_LINES" --no-pager >"$log_file"

found_patterns=0
total_matches=0

for pattern in "${PROHIBITED_PATTERNS[@]}"; do
  matches="$(grep -niF "$pattern" "$log_file" || true)"
  [[ -z "$matches" ]] && continue

  found_patterns=1
  match_count="$(printf '%s\n' "$matches" | grep -c . || true)"
  total_matches=$((total_matches + match_count))

  log "BLOCKER pattern detected: $pattern ($match_count matches)"
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    log "  $line"
  done <<<"$matches"
done

if (( found_patterns )); then
  if (( STRICT )); then
    log "FAIL: prohibited runtime patterns detected ($total_matches matches)"
    exit 1
  fi

  log "WARN: prohibited runtime patterns detected but strict mode is disabled"
fi

if (( !SKIP_VISUAL )) && [[ -x "$VISUAL_QA_SCRIPT" ]]; then
  log "step 4/4: run UX/static visual gate"
  if ! bash "$VISUAL_QA_SCRIPT"; then
    if (( STRICT )); then
      log "FAIL: bootstrap/qa-visual.sh"
      exit 1
    fi
    log "WARN: visual gate failed but strict mode is disabled"
  fi
else
  if (( SKIP_VISUAL )); then
    log "step 4/4: visual gate skipped by --skip-visual"
  else
    log "step 4/4: visual gate not found/executable, skipping"
  fi
fi

log "PASS: runtime + UX gate clean"
exit 0
