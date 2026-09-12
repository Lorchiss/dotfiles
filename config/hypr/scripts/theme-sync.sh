#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CONFIG_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/hypr"
STATE_FILE="$STATE_DIR/theme-mode"
DRY_RUN=0
FILES_ONLY=0

usage() {
  printf '%s\n' \
    'Usage: theme-sync.sh [--dry-run] [--files-only] [dark|light|toggle|apply|status]' \
    'Persist/apply Kitty, Rofi and GTK preferences. Default: apply.' \
    '--dry-run     No writes or desktop changes.' \
    '--files-only  Write palettes and state, but skip GTK and GSettings.' \
    'Quickshell and the wallpaper keep their dark Polar appearance.'
}

read_mode() {
  local mode=dark
  if [[ -f "$STATE_FILE" ]]; then mode="$(tr -d '[:space:]' < "$STATE_FILE")"; fi
  case "$mode" in dark|light) printf '%s\n' "$mode" ;; *) echo dark ;; esac
}

# Avoid rewriting unchanged files: consumers may hot reload when files change.
publish() {
  local temporary="$1" target="$2"
  if cmp -s "$temporary" "$target"; then
    rm -- "$temporary"
  else
    if [[ -f "$target" ]]; then chmod --reference="$target" "$temporary"; else chmod 644 "$temporary"; fi
    mv -f -- "$temporary" "$target"
  fi
}

copy_theme() {
  local source="$1" target="$2" temporary
  if [[ -L "$target" ]]; then target="$(readlink -f "$target")"; fi
  mkdir -p "$(dirname "$target")"
  temporary="$(mktemp "${target}.XXXXXX")"
  cp -- "$source" "$temporary"
  publish "$temporary" "$target"
}

gtk_settings() {
  local target="$1" dark="$2" temporary input=/dev/null
  if [[ -L "$target" ]]; then target="$(readlink -f "$target")"; fi
  mkdir -p "$(dirname "$target")"
  [[ ! -f "$target" ]] || input="$target"
  temporary="$(mktemp "${target}.XXXXXX")"
  # Update only our two keys inside [Settings]; preserve comments and other groups.
  awk -v dark="$dark" '
    function finish() {
      if (settings && !font_seen) print "gtk-font-name=IBM Plex Sans 11"
      if (settings && !dark_seen) print "gtk-application-prefer-dark-theme=" dark
    }
    /^\[[^]]+\][[:space:]]*$/ {
      finish()
      settings = ($0 ~ /^\[Settings\]/)
      if (settings) found = 1
      font_seen = dark_seen = 0
    }
    settings && /^[[:space:]]*gtk-font-name[[:space:]]*=/ {
      if (!font_seen++) print "gtk-font-name=IBM Plex Sans 11"
      next
    }
    settings && /^[[:space:]]*gtk-application-prefer-dark-theme[[:space:]]*=/ {
      if (!dark_seen++) print "gtk-application-prefer-dark-theme=" dark
      next
    }
    { print }
    END {
      finish()
      if (!found) {
        print "[Settings]"
        print "gtk-font-name=IBM Plex Sans 11"
        print "gtk-application-prefer-dark-theme=" dark
      }
    }
  ' "$input" > "$temporary"
  publish "$temporary" "$target"
}

apply_gtk() {
  local mode="$1" dark=0 scheme=default
  if [[ "$mode" == dark ]]; then dark=1; scheme=prefer-dark; fi
  gtk_settings "$CONFIG_DIR/gtk-3.0/settings.ini" "$dark"
  gtk_settings "$CONFIG_DIR/gtk-4.0/settings.ini" "$dark"
  if command -v gsettings >/dev/null 2>&1; then
    gsettings set org.gnome.desktop.interface font-name 'IBM Plex Sans 11' \
      || echo '[theme] GTK font preference could not be published' >&2
    gsettings set org.gnome.desktop.interface color-scheme "$scheme" \
      || echo '[theme] GTK color preference could not be published' >&2
  fi
}

main() {
  local action=apply mode source action_seen=0
  while (($#)); do
    case "$1" in
      --dry-run) DRY_RUN=1 ;;
      --files-only) FILES_ONLY=1 ;;
      dark|light|toggle|apply|status)
        if ((action_seen)); then usage >&2; return 2; fi
        action="$1"; action_seen=1 ;;
      -h|--help) usage; return ;;
      *) usage >&2; return 2 ;;
    esac
    shift
  done
  mode="$(read_mode)"
  case "$action" in
    status) printf '%s\n' "$mode"; return ;;
    dark|light) mode="$action" ;;
    toggle) if [[ "$mode" == dark ]]; then mode=light; else mode=dark; fi ;;
  esac
  for source in "$CONFIG_ROOT/kitty/themes/polar-$mode.conf" \
      "$CONFIG_ROOT/rofi/themes/polar-$mode.rasi" \
      "$CONFIG_ROOT/rofi/themes/polar-glow-compat.rasi"; do
    [[ -f "$source" ]] || { echo "[theme] Missing template: $source" >&2; return 1; }
  done
  if ((DRY_RUN)); then
    printf '[dry-run] %s -> Kitty/Rofi in %s; GTK=%s; state=%s\n' \
      "$mode" "$CONFIG_DIR" "$((1 - FILES_ONLY))" "$STATE_FILE"
    return
  fi
  copy_theme "$CONFIG_ROOT/kitty/themes/polar-$mode.conf" "$CONFIG_DIR/kitty/theme-auto.conf"
  copy_theme "$CONFIG_ROOT/rofi/themes/polar-$mode.rasi" "$CONFIG_DIR/rofi/theme-auto.rasi"
  copy_theme "$CONFIG_ROOT/rofi/themes/polar-glow-compat.rasi" "$CONFIG_DIR/rofi/theme-auto-glow.rasi"
  if (( ! FILES_ONLY )); then apply_gtk "$mode"; fi
  mkdir -p "$STATE_DIR"
  if [[ ! -f "$STATE_FILE" || "$(read_mode)" != "$mode" ]]; then
    local temporary
    temporary="$(mktemp "${STATE_FILE}.XXXXXX")"
    printf '%s\n' "$mode" > "$temporary"
    publish "$temporary" "$STATE_FILE"
  fi
  printf '%s\n' "$mode"
}

main "$@"
