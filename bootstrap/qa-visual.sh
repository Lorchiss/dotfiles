#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bootstrap/qa-visual.sh [--evidence-dir DIR]

Visual/UX QA gate for AGS:
- forbidden strings in logs, active window metadata and rendered static labels
- layout and truncation constraints for bar chips
- hierarchy constraints for the base bar composition
- popup orchestration policy checks (priority, offsets, multi-monitor binding)
- dark-mode legibility checks (contrast + min font token size)
EOF
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BAR_FILE="$REPO_DIR/config/ags/widget/Bar.tsx"
ACTIVE_WINDOW_FILE="$REPO_DIR/config/ags/widget/bar/ActiveWindowChip.tsx"
SPOTIFY_BUTTON_FILE="$REPO_DIR/config/ags/widget/bar/SpotifyButton.tsx"
STYLE_FILE="$REPO_DIR/config/ags/style.scss"
OVERLAY_FILE="$REPO_DIR/config/ags/lib/overlayOrchestrator.ts"
SPOTIFY_FILE="$REPO_DIR/config/ags/widget/Spotify.tsx"
CONTROL_CENTER_FILE="$REPO_DIR/config/ags/widget/ControlCenter.tsx"
COMMAND_PALETTE_FILE="$REPO_DIR/config/ags/widget/CommandPalette.tsx"

timestamp="$(date +%Y%m%d-%H%M%S)"
evidence_dir="/tmp/ags-qa/$timestamp/visual"
script_start_human="$(date '+%F %T')"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --evidence-dir)
      if [[ $# -lt 2 ]]; then
        echo "[visual-qa] FAIL: missing value for --evidence-dir" >&2
        exit 2
      fi
      evidence_dir="$2/visual"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "[visual-qa] FAIL: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

mkdir -p "$evidence_dir"

summary_file="$evidence_dir/visual.summary"
details_file="$evidence_dir/visual.details.log"
failures_file="$evidence_dir/visual.failures"
journal_file="$evidence_dir/visual.journal.log"
active_window_file="$evidence_dir/visual.activewindow.json"

: >"$details_file"
: >"$failures_file"

visual_pass=true
pass_count=0
fail_count=0

declare -a failures=()

log() {
  echo "[visual-qa] $*"
}

record_pass() {
  local code="$1"
  local message="$2"
  pass_count="$((pass_count + 1))"
  printf 'PASS|%s|-|%s\n' "$code" "$message" >>"$details_file"
}

record_fail() {
  local severity="$1"
  local code="$2"
  local message="$3"
  visual_pass=false
  fail_count="$((fail_count + 1))"
  local line="FAIL|$code|$severity|$message"
  failures+=("$severity|$code|$message")
  printf '%s\n' "$line" >>"$details_file"
  printf '%s\n' "$severity|$code|$message" >>"$failures_file"
}

count_regex() {
  local pattern="$1"
  local target_file="$2"
  (rg -o -N "$pattern" "$target_file" 2>/dev/null || true) \
    | wc -l \
    | tr -d '[:space:]'
}

layout_missing_selectors() {
  python3 - "$STYLE_FILE" <<'PY'
import re
import sys

path = sys.argv[1]
text = open(path, "r", encoding="utf-8").read()
selectors = [
    ".work-context-block",
    ".primary-status-zone",
    ".right-controls-zone",
    ".active-window-title",
    ".spotify-chip-content",
]

for selector in selectors:
    pattern = rf"{re.escape(selector)}\s*\{{[^}}]*min-width:\s*0\s*;"
    if not re.search(pattern, text, re.S):
        print(selector)
PY
}

log "evidence dir: $evidence_dir"

# 1) Forbidden strings in runtime logs and active-window metadata
if systemctl --user is-active --quiet ags.service; then
  journalctl --user -u ags.service --since "$script_start_human" --no-pager >"$journal_file" \
    || true
else
  : >"$journal_file"
fi

if grep -Ein '\[object|instance wrapper|native@|Accessor \{|\bundefined\b' "$journal_file" \
  >"$evidence_dir/visual.forbidden-runtime.log"; then
  hits="$(wc -l <"$evidence_dir/visual.forbidden-runtime.log" | tr -d '[:space:]')"
  record_fail \
    "P0" \
    "forbidden-runtime-strings" \
    "Forbidden strings detectadas en logs recientes ($hits hits). Revisar visual.forbidden-runtime.log."
else
  record_pass "forbidden-runtime-strings" "Sin forbidden strings en logs recientes de ags.service."
fi

if command -v hyprctl >/dev/null 2>&1; then
  hyprctl -j activewindow 2>/dev/null >"$active_window_file" || echo '{}' >"$active_window_file"
  if python3 - "$active_window_file" >"$evidence_dir/visual.forbidden-activewindow.log" <<'PY'
import json
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    raw = fh.read().strip() or "{}"
try:
    data = json.loads(raw)
except Exception:
    print("invalid-json")
    sys.exit(1)

title = str(data.get("title", "") or "")
app = str(data.get("class", "") or "")
probe = f"{app} {title}".lower()
patterns = [
    r"\[object",
    r"instance wrapper",
    r"native@",
    r"accessor\s*\{",
    r"\bundefined\b",
    r"\bnull\b",
]

for p in patterns:
    if re.search(p, probe):
        print(f"forbidden:{p}:app={app}:title={title}")
        sys.exit(1)

print("ok")
PY
  then
    record_pass "forbidden-activewindow-strings" "Título/clase de ventana activa sin strings técnicos prohibidos."
  else
    record_fail \
      "P0" \
      "forbidden-activewindow-strings" \
      "Metadata de ventana activa contiene strings prohibidos. Revisar visual.forbidden-activewindow.log."
  fi
else
  record_fail \
    "P1" \
    "missing-hyprctl" \
    "No se pudo verificar ventana activa porque hyprctl no está disponible."
fi

static_forbidden_file="$evidence_dir/visual.forbidden-static-labels.log"
: >"$static_forbidden_file"
for pattern in \
  'label\s*=\s*"[^"]*\[object[^"]*"' \
  'label\s*=\s*"[^"]*instance wrapper[^"]*"' \
  'label\s*=\s*"[^"]*native@[^"]*"' \
  'label\s*=\s*"[^"]*\bundefined\b[^"]*"' \
  'label\s*=\s*"[^"]*\bnull\b[^"]*"' \
  'tooltipText\s*=\s*"[^"]*\[object[^"]*"' \
  'tooltipText\s*=\s*"[^"]*\bundefined\b[^"]*"' \
  'tooltipText\s*=\s*"[^"]*\bnull\b[^"]*"'; do
  rg -n "$pattern" "$REPO_DIR/config/ags/widget" >>"$static_forbidden_file" || true
done

if [[ -s "$static_forbidden_file" ]]; then
  hits="$(wc -l <"$evidence_dir/visual.forbidden-static-labels.log" | tr -d '[:space:]')"
  record_fail \
    "P0" \
    "forbidden-static-labels" \
    "Labels estáticos con strings prohibidos ($hits hits). Revisar visual.forbidden-static-labels.log."
else
  record_pass "forbidden-static-labels" "No hay labels estáticos con strings prohibidos."
fi

# 2) Layout constraints
mapfile -t missing_layout_guards < <(layout_missing_selectors)

if [[ "${#missing_layout_guards[@]}" -gt 0 ]]; then
  record_fail \
    "P1" \
    "layout-min-width-guards" \
    "Faltan guardas min-width:0 para: ${missing_layout_guards[*]}"
else
  record_pass "layout-min-width-guards" "Guardas de min-width:0 presentes en contenedores críticos."
fi

if rg -q "widthChars=\\{TITLE_MAX_CHARS\\}" "$ACTIVE_WINDOW_FILE" \
  && rg -q "maxWidthChars=\\{TITLE_MAX_CHARS\\}" "$ACTIVE_WINDOW_FILE" \
  && rg -q "singleLineMode" "$ACTIVE_WINDOW_FILE"; then
  record_pass "layout-active-window-truncation" "ActiveWindowChip aplica truncación/una línea para títulos largos."
else
  record_fail \
    "P1" \
    "layout-active-window-truncation" \
    "ActiveWindowChip no garantiza truncación consistente para títulos largos."
fi

if rg -q "marqueeText\\(" "$SPOTIFY_BUTTON_FILE" \
  && rg -q "widthChars=\\{CHIP_TITLE_WIDTH\\}" "$SPOTIFY_BUTTON_FILE" \
  && rg -q "maxWidthChars=\\{CHIP_TITLE_WIDTH\\}" "$SPOTIFY_BUTTON_FILE" \
  && rg -q "singleLineMode" "$SPOTIFY_BUTTON_FILE"; then
  record_pass "layout-spotify-chip-truncation" "Spotify chip limita texto largo con marquee + ancho fijo."
else
  record_fail \
    "P1" \
    "layout-spotify-chip-truncation" \
    "Spotify chip no cumple política de truncación/contención de texto."
fi

# 3) Hierarchy constraints
count_work_context="$(count_regex 'class="work-context-block"' "$BAR_FILE")"
count_primary_zone="$(count_regex 'class="bar-section-center primary-status-zone"' "$BAR_FILE")"
count_quick_cluster="$(count_regex 'class="quick-controls-cluster"' "$BAR_FILE")"
count_health="$(count_regex '<HealthChip\s*/>' "$BAR_FILE")"
count_maintenance="$(count_regex '<MaintenanceChip\s*/>' "$BAR_FILE")"
count_clock="$(count_regex '<ClockMenu\s*/>' "$BAR_FILE")"
visible_blocks="$((count_work_context + count_primary_zone + count_quick_cluster + count_health + count_maintenance + count_clock))"

if [[ "$count_work_context" -eq 1 && "$count_primary_zone" -eq 1 \
  && "$count_quick_cluster" -eq 1 && "$count_health" -eq 1 \
  && "$count_maintenance" -eq 1 && "$count_clock" -eq 1 \
  && "$visible_blocks" -le 6 ]]; then
  record_pass "hierarchy-max-visible-blocks" "Bar base mantiene 6 bloques visibles (<=6)."
else
  record_fail \
    "P1" \
    "hierarchy-max-visible-blocks" \
    "Estructura de bloques inválida: work=$count_work_context primary=$count_primary_zone quick=$count_quick_cluster health=$count_health maintenance=$count_maintenance clock=$count_clock total=$visible_blocks"
fi

if rg -q '<HealthChip\s*/>' "$BAR_FILE" \
  && rg -q '<MaintenanceChip\s*/>' "$BAR_FILE" \
  && ! rg -qi 'CPU|RAM|TEMP|AUR|NEWS' "$BAR_FILE"; then
  record_pass "hierarchy-grouped-secondary-metrics" "Métricas secundarias agrupadas en Health/Maintenance chips."
else
  record_fail \
    "P1" \
    "hierarchy-grouped-secondary-metrics" \
    "Bar expone métricas secundarias fuera de los bloques agrupados esperados."
fi

primary_status_count="$(count_regex '<PrimaryStatusBlock\b' "$BAR_FILE")"
focus_rule_count="$(count_regex 'overlay-focused' "$STYLE_FILE")"
if [[ "$primary_status_count" -eq 1 && "$count_primary_zone" -eq 1 && "$focus_rule_count" -ge 1 ]]; then
  record_pass "hierarchy-single-focus-source" "Existe una sola fuente primaria de foco visual y política overlay-focused."
else
  record_fail \
    "P1" \
    "hierarchy-single-focus-source" \
    "No se cumple política de foco único (primary_status_count=$primary_status_count focus_rule_count=$focus_rule_count)."
fi

# 4) Popups: no overlap policy and multi-monitor coherence
if rg -q 'activeOverlay === "command-palette"' "$OVERLAY_FILE" \
  && rg -q 'setOverlayVisible\("spotify", false\)' "$OVERLAY_FILE" \
  && rg -q 'setOverlayVisible\("control-center", false\)' "$OVERLAY_FILE"; then
  record_pass "popup-priority-policy" "Policy de prioridad bloquea solapamiento de palette sobre otros overlays."
else
  record_fail \
    "P0" \
    "popup-priority-policy" \
    "Falta policy de prioridad para evitar colisión entre overlays."
fi

if rg -q 'mode = "side"' "$OVERLAY_FILE" \
  && rg -q 'mode = "stack"' "$OVERLAY_FILE" \
  && rg -q 'bothRightPanelsVisible' "$OVERLAY_FILE" \
  && rg -q 'canSideBySide' "$OVERLAY_FILE"; then
  record_pass "popup-dynamic-offset-policy" "Orquestador define side/stack + offsets dinámicos según colisión."
else
  record_fail \
    "P1" \
    "popup-dynamic-offset-policy" \
    "Orquestador no define fallback side/stack y offsets dinámicos completos."
fi

popup_binding_ok=true
for popup_file in "$SPOTIFY_FILE" "$CONTROL_CENTER_FILE" "$COMMAND_PALETTE_FILE"; do
  if ! rg -q "overlayLayoutBinding" "$popup_file" \
    || ! rg -q "registerOverlayWindow" "$popup_file" \
    || ! rg -q "onOverlayVisibilityChanged" "$popup_file" \
    || ! rg -q "monitorFromLayout" "$popup_file" \
    || ! rg -q "gdkmonitor=\{overlayLayout\(" "$popup_file"; then
    popup_binding_ok=false
    break
  fi
done

if [[ "$popup_binding_ok" == true ]]; then
  record_pass "popup-multi-monitor-binding" "Todos los popups usan binding de layout/monitor orquestado."
else
  record_fail \
    "P1" \
    "popup-multi-monitor-binding" \
    "Uno o más popups no están vinculados al orquestador multi-monitor."
fi

# 5) Legibility
if contrast_output="$(
  python3 - "$STYLE_FILE" <<'PY'
import re
import sys

path = sys.argv[1]
text = open(path, "r", encoding="utf-8").read()

variables = {}
for m in re.finditer(r"^\s*\$([\w-]+):\s*([^;]+);", text, re.M):
    variables[m.group(1)] = m.group(2).strip()

def resolve_hex(name, seen=None):
    seen = seen or set()
    if name in seen:
        return None
    value = variables.get(name)
    if value is None:
        return None
    if value.startswith("$"):
        return resolve_hex(value[1:], seen | {name})
    if re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        return value.lower()
    return None

def to_lin(c):
    c = c / 255.0
    if c <= 0.03928:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4

def luminance(hex_color):
    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)
    return 0.2126 * to_lin(r) + 0.7152 * to_lin(g) + 0.0722 * to_lin(b)

fg = resolve_hex("ag-text-primary")
bg = resolve_hex("ag-surface-canvas")
if not fg or not bg:
    print("parse_error")
    sys.exit(2)

l1 = luminance(fg)
l2 = luminance(bg)
ratio = (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
print(f"{ratio:.2f}")
PY
)"; then
  if awk "BEGIN { exit !($contrast_output >= 4.5) }"; then
    record_pass "legibility-dark-contrast" "Contraste tokenizado OK (ratio $contrast_output >= 4.5)."
  else
    record_fail \
      "P1" \
      "legibility-dark-contrast" \
      "Contraste insuficiente entre text-primary y surface-canvas (ratio $contrast_output < 4.5)."
  fi
else
  record_fail \
    "P1" \
    "legibility-dark-contrast" \
    "No se pudo calcular ratio de contraste tokenizado."
fi

if font_token_min="$(
  python3 - "$STYLE_FILE" <<'PY'
import re
import sys

path = sys.argv[1]
text = open(path, "r", encoding="utf-8").read()
values = [
    float(v)
    for _, v in re.findall(r"^\s*\$(ag-font-[\w-]+):\s*([0-9]+(?:\.[0-9]+)?)px\s*;", text, re.M)
]
if not values:
    print("nan")
    sys.exit(2)
print(f"{min(values):.2f}")
PY
)"; then
  if awk "BEGIN { exit !($font_token_min >= 10) }"; then
    record_pass "legibility-min-font-size" "Escala tipográfica mínima legible OK (${font_token_min}px)."
  else
    record_fail \
      "P2" \
      "legibility-min-font-size" \
      "Escala tipográfica mínima bajo 10px (${font_token_min}px)."
  fi
else
  record_fail \
    "P2" \
    "legibility-min-font-size" \
    "No se pudo validar escala tipográfica mínima."
fi

{
  echo "visual_pass=$visual_pass"
  echo "checks_passed=$pass_count"
  echo "checks_failed=$fail_count"
  echo "details_file=$details_file"
  echo "failures_file=$failures_file"
  echo "journal_file=$journal_file"
  echo "active_window_file=$active_window_file"
} >"$summary_file"

log "visual summary:"
sed 's/^/[visual-qa]   /' "$summary_file"

if [[ "$visual_pass" == true ]]; then
  log "PASS"
  exit 0
fi

log "FAIL"
while IFS='|' read -r severity code message; do
  [[ -z "${severity:-}" ]] && continue
  log "  $severity $code: $message"
done <"$failures_file"
exit 1
