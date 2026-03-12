#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/hypr"
STATE_FILE="$STATE_DIR/theme-mode"

KITTY_THEME_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/kitty/theme-auto.conf"
ROFI_THEME_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/rofi/theme-auto.rasi"
ROFI_GLOW_THEME_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/rofi/theme-auto-glow.rasi"

usage() {
  cat <<'EOF'
Usage: theme-sync.sh [dark|light|toggle|apply|status]

Commands:
  dark    Persist and apply dark mode
  light   Persist and apply light mode
  toggle  Toggle mode, persist and apply
  apply   Re-apply persisted mode (default: dark if none)
  status  Print current persisted mode
EOF
}

normalize_mode() {
  local mode="${1:-}"
  case "$mode" in
    dark|light) printf '%s\n' "$mode" ;;
    *) printf 'dark\n' ;;
  esac
}

read_mode() {
  if [[ -f "$STATE_FILE" ]]; then
    local stored
    stored="$(tr -d '[:space:]' <"$STATE_FILE" || true)"
    normalize_mode "$stored"
    return
  fi
  printf 'dark\n'
}

write_mode() {
  local mode="$1"
  mkdir -p "$STATE_DIR"
  printf '%s' "$mode" >"$STATE_FILE"
}

apply_gtk() {
  local mode="$1"
  if ! command -v gsettings >/dev/null 2>&1; then
    return
  fi

  if [[ "$mode" == "dark" ]]; then
    gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark' >/dev/null 2>&1 || true
  else
    gsettings set org.gnome.desktop.interface color-scheme 'default' >/dev/null 2>&1 || true
  fi
}

write_kitty_theme() {
  local mode="$1"
  mkdir -p "$(dirname "$KITTY_THEME_FILE")"

  if [[ "$mode" == "dark" ]]; then
    cat >"$KITTY_THEME_FILE" <<'EOF'
# Managed by ~/.config/hypr/scripts/theme-sync.sh
background #0f0f0f
foreground #e6e6e6
selection_background #2a2a2a
selection_foreground #ffffff
cursor #4c8bf5

color0  #1a1a1a
color1  #c25f5f
color2  #7fb069
color3  #d7ba7d
color4  #4c8bf5
color5  #c586c0
color6  #4ec9b0
color7  #e6e6e6

color8  #5c5c5c
color9  #d16969
color10 #8ec07c
color11 #e5c07b
color12 #6ca0f6
color13 #d19ad9
color14 #56b6c2
color15 #ffffff
EOF
  else
    cat >"$KITTY_THEME_FILE" <<'EOF'
# Managed by ~/.config/hypr/scripts/theme-sync.sh
background #f6f8fc
foreground #1e2430
selection_background #dce6f7
selection_foreground #152133
cursor #2f6feb

color0  #e4e7ee
color1  #b42318
color2  #1f883d
color3  #9a6700
color4  #175cd3
color5  #8250df
color6  #0e7490
color7  #1f2937

color8  #98a2b3
color9  #d92d20
color10 #2da44e
color11 #bf8700
color12 #1d4ed8
color13 #7c3aed
color14 #0369a1
color15 #0f172a
EOF
  fi
}

write_rofi_theme() {
  local mode="$1"
  mkdir -p "$(dirname "$ROFI_THEME_FILE")"

  if [[ "$mode" == "dark" ]]; then
    cat >"$ROFI_THEME_FILE" <<'EOF'
* {
  bg0: #0f0f0f;
  bg1: #151515;
  bg2: #1c1c1c;
  fg0: #e6e6e6;
  fg1: #9a9a9a;
  accent: rgba(76, 139, 245, 0.18);
}
EOF
  else
    cat >"$ROFI_THEME_FILE" <<'EOF'
* {
  bg0: #f6f8fc;
  bg1: #edf2fb;
  bg2: #dde6f5;
  fg0: #1d2433;
  fg1: #4a5870;
  accent: rgba(37, 99, 235, 0.18);
}
EOF
  fi
}

write_rofi_glow_theme() {
  local mode="$1"
  mkdir -p "$(dirname "$ROFI_GLOW_THEME_FILE")"

  if [[ "$mode" == "dark" ]]; then
    cat >"$ROFI_GLOW_THEME_FILE" <<'EOF'
* {
  bg: #0b0f17ee;
  bg2: #111827ee;
  fg: #dbeafe;
  dim: #94a3b8;
  accent: #22d3ee;
  selection_fg: #001018;
}
EOF
  else
    cat >"$ROFI_GLOW_THEME_FILE" <<'EOF'
* {
  bg: #f6f9ffee;
  bg2: #e7eefbee;
  fg: #1f2937;
  dim: #51607a;
  accent: #2563eb;
  selection_fg: #ffffff;
}
EOF
  fi
}

apply_mode() {
  local mode="$1"
  apply_gtk "$mode"
  write_kitty_theme "$mode"
  write_rofi_theme "$mode"
  write_rofi_glow_theme "$mode"
  printf '%s\n' "$mode"
}

set_mode() {
  local mode
  mode="$(normalize_mode "${1:-dark}")"
  write_mode "$mode"
  apply_mode "$mode"
}

main() {
  local command="${1:-apply}"
  case "$command" in
    dark|light)
      set_mode "$command"
      ;;
    toggle)
      local current next
      current="$(read_mode)"
      if [[ "$current" == "dark" ]]; then
        next="light"
      else
        next="dark"
      fi
      set_mode "$next"
      ;;
    apply)
      apply_mode "$(read_mode)"
      ;;
    status)
      read_mode
      ;;
    -h|--help)
      usage
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "${1:-apply}"
