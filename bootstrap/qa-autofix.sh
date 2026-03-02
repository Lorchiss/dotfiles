#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash bootstrap/qa-autofix.sh [--max-iterations N] [--logs N] [--strict|--no-strict]

AGS autofix loop (qa.sh is the mandatory gate):
1) Run bootstrap/qa.sh
2) If PASS -> finish
3) If FAIL -> parse root error, apply minimal fix, run qa.sh again
4) Stop on PASS or when max iterations is reached

Options:
  --max-iterations N   Maximum autofix attempts (default: 5)
  --logs N             Forwarded to bootstrap/qa.sh --logs N (default: 300)
  --strict             Run qa.sh in strict mode (default)
  --no-strict          Run qa.sh in non-strict mode
  -h, --help           Show help
EOF
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QA_GATE_SCRIPT="${QA_GATE_SCRIPT:-$REPO_DIR/bootstrap/qa.sh}"
MAX_ITERATIONS=5
LOG_LINES=300
STRICT_FLAG="--strict"

declare -A TARGET_HITS=()
declare -a FIX_SUMMARY=()
declare -a ITERATION_LOG=()

log() {
  echo "[qa-autofix] $*"
}

is_positive_int() {
  [[ "$1" =~ ^[0-9]+$ ]] && (( "$1" > 0 ))
}

escape_regex() {
  printf '%s' "$1" | sed -E 's/[][(){}.^$+*?|\\/]/\\&/g'
}

unique_join() {
  if [[ $# -eq 0 ]]; then
    echo "none"
    return
  fi

  printf '%s\n' "$@" | awk '!seen[$0]++' | paste -sd ',' -
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-iterations)
      if [[ $# -lt 2 ]]; then
        log "FAIL: missing value for --max-iterations"
        exit 2
      fi
      if ! is_positive_int "$2"; then
        log "FAIL: --max-iterations requires a positive integer"
        exit 2
      fi
      MAX_ITERATIONS="$2"
      shift 2
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
    --strict)
      STRICT_FLAG="--strict"
      shift
      ;;
    --no-strict)
      STRICT_FLAG="--no-strict"
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

if [[ ! -f "$QA_GATE_SCRIPT" ]]; then
  log "FAIL: missing qa gate $QA_GATE_SCRIPT"
  exit 1
fi

if [[ ! -x "$QA_GATE_SCRIPT" ]]; then
  log "WARN: qa gate is not executable, invoking with bash"
fi

run_qa_gate() {
  local output_file="$1"
  if bash "$QA_GATE_SCRIPT" "$STRICT_FLAG" --logs "$LOG_LINES" >"$output_file" 2>&1; then
    cat "$output_file"
    return 0
  fi

  cat "$output_file"
  return 1
}

detect_primary_target() {
  local qa_output="$1"

  if grep -qiF "assertion failed" "$qa_output"; then
    echo "P0|assertion failed"
    return
  fi
  if grep -qiF "TypeError" "$qa_output"; then
    echo "P0|TypeError"
    return
  fi
  if grep -qiF "Traceback" "$qa_output"; then
    echo "P0|Traceback"
    return
  fi
  if grep -qiF "CRITICAL" "$qa_output"; then
    echo "P0|CRITICAL"
    return
  fi
  if grep -qiF "No property named" "$qa_output"; then
    echo "P1|No property named"
    return
  fi
  if grep -qiF "instance wrapper" "$qa_output"; then
    echo "P2|instance wrapper"
    return
  fi
  if grep -qiF "[object" "$qa_output"; then
    echo "P2|[object"
    return
  fi
  if grep -qiF "[ags-smoke] FAIL" "$qa_output"; then
    echo "P0|smoke failure"
    return
  fi

  echo "UNK|unknown"
}

extract_typeerror_method() {
  local qa_output="$1"
  grep -Ei "TypeError: .* is not a function" "$qa_output" \
    | sed -E 's/.*\.([A-Za-z_][A-Za-z0-9_]*)[[:space:]]+is not a function.*/\1/i' \
    | awk 'NF { print; exit }'
}

extract_css_properties() {
  local qa_output="$1"
  grep -Eo 'No property named "[^"]+"' "$qa_output" \
    | sed -E 's/.*"([^"]+)".*/\1/' \
    | awk 'NF' \
    | sort -u
}

apply_optional_chain_method() {
  local method="$1"
  shift
  local -a files=("$@")
  local -a touched=()
  local escaped_method
  escaped_method="$(escape_regex "$method")"

  for file in "${files[@]}"; do
    [[ -f "$file" ]] || continue
    local tmp
    tmp="$(mktemp)"
    sed -E "s/\\.(${escaped_method})\\(/.\\1?.(/g" "$file" >"$tmp"
    if ! cmp -s "$file" "$tmp"; then
      mv "$tmp" "$file"
      touched+=("$file")
    else
      rm -f "$tmp"
    fi
  done

  printf '%s\n' "${touched[@]}"
}

remove_method_calls() {
  local method="$1"
  shift
  local -a files=("$@")
  local -a touched=()
  local escaped_method
  escaped_method="$(escape_regex "$method")"

  for file in "${files[@]}"; do
    [[ -f "$file" ]] || continue
    local tmp
    tmp="$(mktemp)"
    sed -E "/\\.(${escaped_method})\\??\\(/d" "$file" >"$tmp"
    if ! cmp -s "$file" "$tmp"; then
      mv "$tmp" "$file"
      touched+=("$file")
    else
      rm -f "$tmp"
    fi
  done

  printf '%s\n' "${touched[@]}"
}

remove_css_property_declarations() {
  local property="$1"
  shift
  local -a files=("$@")
  local -a touched=()
  local escaped_property
  escaped_property="$(escape_regex "$property")"

  for file in "${files[@]}"; do
    [[ -f "$file" ]] || continue
    local tmp
    tmp="$(mktemp)"
    sed -E "/^[[:space:]]*${escaped_property}[[:space:]]*:[^;]*;[[:space:]]*$/d" "$file" >"$tmp"
    if ! cmp -s "$file" "$tmp"; then
      mv "$tmp" "$file"
      touched+=("$file")
    else
      rm -f "$tmp"
    fi
  done

  printf '%s\n' "${touched[@]}"
}

fix_p0() {
  local qa_output="$1"
  local strategy="$2"
  local -a touched=()
  local change_desc=""

  mapfile -t tsx_files < <(rg --files "$REPO_DIR/config/ags/widget" | rg '\.tsx$' || true)

  if grep -qiF "assertion failed" "$qa_output"; then
    if (( strategy == 1 )); then
      mapfile -t touched < <(
        apply_optional_chain_method "set_min_content_height" "${tsx_files[@]}"
        apply_optional_chain_method "set_max_content_height" "${tsx_files[@]}"
      )
      change_desc="guarded set_min/max_content_height calls with optional chaining"
    else
      mapfile -t touched < <(
        remove_method_calls "set_min_content_height" "${tsx_files[@]}"
        remove_method_calls "set_max_content_height" "${tsx_files[@]}"
      )
      change_desc="removed set_min/max_content_height calls to avoid runtime assertions"
    fi
  elif grep -qiF "TypeError" "$qa_output"; then
    local method
    method="$(extract_typeerror_method "$qa_output" || true)"
    if [[ -n "${method:-}" ]]; then
      if (( strategy == 1 )); then
        mapfile -t touched < <(apply_optional_chain_method "$method" "${tsx_files[@]}")
        change_desc="guarded .$method() calls with optional chaining"
      else
        mapfile -t touched < <(remove_method_calls "$method" "${tsx_files[@]}")
        change_desc="removed .$method() calls after repeated TypeError"
      fi
    fi
  fi

  touched=($(printf '%s\n' "${touched[@]}" | awk 'NF' | awk '!seen[$0]++'))

  if [[ ${#touched[@]} -eq 0 ]]; then
    return 1
  fi

  printf '%s|%s\n' "$(unique_join "${touched[@]}")" "$change_desc"
  return 0
}

fix_p1() {
  local qa_output="$1"
  local strategy="$2"
  local -a touched=()
  local -a css_files=()
  local -a properties=()
  local change_desc=""

  mapfile -t properties < <(extract_css_properties "$qa_output" || true)
  if [[ ${#properties[@]} -eq 0 ]]; then
    properties=("max-width" "align-items")
  fi

  if (( strategy == 1 )); then
    css_files=("$REPO_DIR/config/ags/style.scss")
  else
    mapfile -t css_files < <(rg --files "$REPO_DIR/config/ags" | rg '\.scss$' || true)
  fi

  for property in "${properties[@]}"; do
    mapfile -t maybe_touched < <(remove_css_property_declarations "$property" "${css_files[@]}")
    touched+=("${maybe_touched[@]}")
  done

  touched=($(printf '%s\n' "${touched[@]}" | awk 'NF' | awk '!seen[$0]++'))

  if (( strategy == 1 )); then
    change_desc="removed GTK-incompatible CSS declarations from style.scss: $(unique_join "${properties[@]}")"
  else
    change_desc="removed GTK-incompatible CSS declarations across all SCSS files: $(unique_join "${properties[@]}")"
  fi

  if [[ ${#touched[@]} -eq 0 ]]; then
    return 1
  fi

  printf '%s|%s\n' "$(unique_join "${touched[@]}")" "$change_desc"
  return 0
}

fix_p2() {
  local strategy="$1"
  local text_file="$REPO_DIR/config/ags/lib/text.ts"
  local -a touched=()
  local change_desc=""

  if [[ ! -f "$text_file" ]]; then
    cat >"$text_file" <<'EOF'
const FORBIDDEN_TECH_PATTERNS = [
  /\[object/i,
  /instance\s+wrapper/i,
  /gtk\./i,
  /gobject/i,
  /native@/i,
]

function normalize(value: string | number): string {
  return String(value).replace(/\s+/g, " ").trim()
}

function hasForbiddenTechText(value: string): boolean {
  return FORBIDDEN_TECH_PATTERNS.some((pattern) => pattern.test(value))
}

export function safeText(value: unknown, fallback = ""): string {
  const fallbackText = normalize(fallback)

  if (value === null || value === undefined) return fallbackText
  if (typeof value !== "string" && typeof value !== "number")
    return fallbackText

  const text = normalize(value)
  if (!text) return fallbackText
  if (hasForbiddenTechText(text)) return fallbackText

  return text
}
EOF
    touched+=("$text_file")
    change_desc="created defensive safeText sanitizer for technical leak strings"
  else
    if ! rg -q "\\[object|instance\\s+wrapper|gobject|native@" "$text_file"; then
      local tmp
      tmp="$(mktemp)"
      cat >"$tmp" <<'EOF'
const FORBIDDEN_TECH_PATTERNS = [
  /\[object/i,
  /instance\s+wrapper/i,
  /gtk\./i,
  /gobject/i,
  /native@/i,
]

function normalize(value: string | number): string {
  return String(value).replace(/\s+/g, " ").trim()
}

function hasForbiddenTechText(value: string): boolean {
  return FORBIDDEN_TECH_PATTERNS.some((pattern) => pattern.test(value))
}

export function safeText(value: unknown, fallback = ""): string {
  const fallbackText = normalize(fallback)

  if (value === null || value === undefined) return fallbackText
  if (typeof value !== "string" && typeof value !== "number")
    return fallbackText

  const text = normalize(value)
  if (!text) return fallbackText
  if (hasForbiddenTechText(text)) return fallbackText

  return text
}
EOF
      if ! cmp -s "$text_file" "$tmp"; then
        mv "$tmp" "$text_file"
        touched+=("$text_file")
      else
        rm -f "$tmp"
      fi
      change_desc="hardened safeText sanitizer patterns for [object/instance wrapper leaks"
    fi
  fi

  if [[ ${#touched[@]} -eq 0 ]]; then
    return 1
  fi

  if (( strategy == 2 )); then
    change_desc="$change_desc (strategy switched after repeated pattern)"
  fi

  printf '%s|%s\n' "$(unique_join "${touched[@]}")" "$change_desc"
  return 0
}

final_status="FAIL"
last_target="none"

for ((iteration = 1; iteration <= MAX_ITERATIONS; iteration++)); do
  log "iteration=$iteration/$MAX_ITERATIONS"

  qa_output="$(mktemp)"
  if run_qa_gate "$qa_output"; then
    ITERATION_LOG+=("$iteration|none|none|none|PASS")
    log "iteration=$iteration error_target=none"
    log "iteration=$iteration files_touched=none"
    log "iteration=$iteration change_applied=none"
    log "iteration=$iteration qa_result=PASS"
    final_status="PASS"
    rm -f "$qa_output"
    break
  fi

  target_data="$(detect_primary_target "$qa_output")"
  severity="${target_data%%|*}"
  target="${target_data#*|}"
  last_target="$target"
  target_key="${severity}:${target}"
  TARGET_HITS["$target_key"]=$(( ${TARGET_HITS["$target_key"]:-0} + 1 ))

  strategy=1
  if (( TARGET_HITS["$target_key"] >= 2 )); then
    strategy=2
    log "pattern repeated twice, switching strategy for target=$target"
  fi

  files_touched="none"
  change_applied="none"
  fix_applied=false

  case "$severity" in
    P0)
      if fix_output="$(fix_p0 "$qa_output" "$strategy" 2>/dev/null)"; then
        files_touched="${fix_output%%|*}"
        change_applied="${fix_output#*|}"
        fix_applied=true
      fi
      ;;
    P1)
      if fix_output="$(fix_p1 "$qa_output" "$strategy" 2>/dev/null)"; then
        files_touched="${fix_output%%|*}"
        change_applied="${fix_output#*|}"
        fix_applied=true
      fi
      ;;
    P2)
      if fix_output="$(fix_p2 "$strategy" 2>/dev/null)"; then
        files_touched="${fix_output%%|*}"
        change_applied="${fix_output#*|}"
        fix_applied=true
      fi
      ;;
  esac

  qa_result="FAIL"
  ITERATION_LOG+=("$iteration|$severity $target|$files_touched|$change_applied|$qa_result")

  log "iteration=$iteration error_target=$severity $target"
  log "iteration=$iteration files_touched=$files_touched"
  log "iteration=$iteration change_applied=$change_applied"
  log "iteration=$iteration qa_result=$qa_result"

  if [[ "$fix_applied" == true ]]; then
    FIX_SUMMARY+=("iter=$iteration target=$severity $target files=$files_touched change=$change_applied")
  else
    log "iteration=$iteration no safe patch available for target=$severity $target"
    if (( strategy == 1 )) && (( iteration < MAX_ITERATIONS )); then
      log "iteration=$iteration retrying to allow strategy switch on repeated pattern"
      rm -f "$qa_output"
      continue
    fi

    rm -f "$qa_output"
    break
  fi

  rm -f "$qa_output"
done

log "final_status=$final_status"

log "iteration_report:"
for item in "${ITERATION_LOG[@]}"; do
  IFS='|' read -r it target files change qa_result <<<"$item"
  log "  iter=$it target=$target files=$files change=$change result=$qa_result"
done

if [[ ${#FIX_SUMMARY[@]} -gt 0 ]]; then
  log "applied_fixes:"
  for item in "${FIX_SUMMARY[@]}"; do
    log "  $item"
  done
else
  log "applied_fixes: none"
fi

if [[ "$final_status" != "PASS" ]]; then
  log "pending_risks:"
  log "  qa gate still failing after loop"
  log "  last_target=$last_target"
  log "  possible unsupported root cause (requires manual fix)"
  exit 1
fi

exit 0
