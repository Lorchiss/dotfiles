#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREVIEW_DIR=""

usage() {
  printf '%s\n' \
    'Usage: bash bootstrap/polar-visual-check.sh [--preview-dir DIR]' \
    'Validate the integrated Polar desktop profiles without changing the session.' \
    '--preview-dir DIR  Also render a 1920x1080 wallpaper preview into DIR.'
}

while (($#)); do
  case "$1" in
    --preview-dir)
      if (($# < 2)) || [[ -z "$2" || "$2" == -* ]]; then
        echo '[polar-visual] --preview-dir requires a directory' >&2
        exit 2
      fi
      PREVIEW_DIR="$2"
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

for tool in Hyprland rofi kitty rsvg-convert rg; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[polar-visual] Missing validation tool: $tool (nothing installed)" >&2
    exit 1
  fi
done

TMP_DIR="$(mktemp -d -t polar-visual-check.XXXXXX)"
trap 'rm -rf -- "$TMP_DIR"' EXIT

HYPR_PROFILE="$REPO_DIR/config/hypr/themes/polar.conf"
ROFI_PROFILE="$REPO_DIR/config/rofi/polar.rasi"
KITTY_PROFILE="$REPO_DIR/config/kitty/themes/polar-dark.conf"
ROFI_PALETTE="$REPO_DIR/config/rofi/themes/polar-dark.rasi"
WALLPAPER="$REPO_DIR/config/hypr/wallpapers/polar-contour.svg"

# These commands parse configuration only: no compositor, launcher or terminal
# is started. The temporary logs are shown only when a check fails.
if ! Hyprland --verify-config --config "$HYPR_PROFILE" >"$TMP_DIR/hypr.log" 2>&1 \
    || ! rg -q '^config ok$' "$TMP_DIR/hypr.log"; then
  cat "$TMP_DIR/hypr.log" >&2
  exit 1
fi
echo '[polar-visual] PASS: Hyprland profile syntax'

if ! rofi -no-config -theme "$ROFI_PROFILE" -dump-theme >"$TMP_DIR/rofi.log" 2>"$TMP_DIR/rofi.err" \
    || [[ -s "$TMP_DIR/rofi.err" ]] \
    || ! rg -q '560px' "$TMP_DIR/rofi.log"; then
  cat "$TMP_DIR/rofi.err" >&2
  echo '[polar-visual] FAIL: Rofi theme parse' >&2
  exit 1
fi
echo '[polar-visual] PASS: Rofi theme syntax'

POLAR_REPO="$REPO_DIR" kitty +runpy '
import os
from kitty.config import load_config
root = os.environ["POLAR_REPO"]
errors = []
for mode, background in (("dark", "#080d14"), ("light", "#f6f8fc")):
    opts = load_config(root + "/config/kitty/kitty.conf",
                      root + "/config/kitty/themes/polar-" + mode + ".conf",
                      accumulate_bad_lines=errors)
    assert not errors, errors
    assert opts.background_opacity == 0.96
    assert str(opts.background) == background
print("[polar-visual] PASS: canonical Kitty geometry with dark/light palettes")
'

# Validate both Rofi palettes in an isolated copy, not in the active session.
mkdir -p "$TMP_DIR/config"
cp -R "$REPO_DIR/config/rofi" "$TMP_DIR/config/rofi"
for mode in dark light; do
  XDG_CONFIG_HOME="$TMP_DIR/config" XDG_STATE_HOME="$TMP_DIR/state" \
    bash "$REPO_DIR/config/hypr/scripts/theme-sync.sh" --files-only "$mode" >/dev/null
  if ! rofi -config "$TMP_DIR/config/rofi/config.rasi" -dump-theme \
      >"$TMP_DIR/rofi-$mode.log" 2>"$TMP_DIR/rofi-$mode.err" \
      || [[ -s "$TMP_DIR/rofi-$mode.err" ]]; then
    cat "$TMP_DIR/rofi-$mode.err" >&2
    exit 1
  fi
done
echo '[polar-visual] PASS: canonical Rofi entry with dark/light palettes'

# Keep the profiles aligned with Polar without adding a runtime generator.
for color in 080d14 29435a 79c7ff; do
  for file in "$REPO_DIR/config/quickshell/Theme.qml" "$HYPR_PROFILE" "$KITTY_PROFILE" "$ROFI_PALETTE"; do
    if ! rg -qi "$color" "$file"; then
      echo "[polar-visual] FAIL: missing shared color $color in $file" >&2
      exit 1
    fi
  done
done

if rg -n '^\s*(monitor|bind|exec|exec-once|source|env)\s*=' "$HYPR_PROFILE" \
    || rg -n '<(animate|set|script|image)\b|href="https?://' "$WALLPAPER"; then
  echo '[polar-visual] FAIL: profiles must be appearance-only and wallpaper static/local' >&2
  exit 1
fi
echo '[polar-visual] PASS: shared colors and appearance-only scope'

grep -Fq 'source = ~/.config/hypr/themes/polar.conf' \
  "$REPO_DIR/config/hypr/conf.d/30-decoration.conf"
grep -q '^ExecStart=.*start-wallpaper.sh --daemon$' \
  "$REPO_DIR/config/systemd/user/polar-wallpaper.service"
if grep -q '^WantedBy=' "$REPO_DIR/config/systemd/user/polar-wallpaper.service"; then
  echo '[polar-visual] FAIL: wallpaper must start from its Wayland session' >&2
  exit 1
fi
echo '[polar-visual] PASS: persistent profile entry and supervised wallpaper'

rsvg-convert --width 1920 --height 1080 --output "$TMP_DIR/polar-contour.png" "$WALLPAPER"
echo '[polar-visual] PASS: wallpaper render at 1920x1080'

if [[ -n "$PREVIEW_DIR" ]]; then
  mkdir -p -- "$PREVIEW_DIR"
  cp -- "$TMP_DIR/polar-contour.png" "$PREVIEW_DIR/polar-contour.png"
  printf '[polar-visual] Preview: %s/polar-contour.png\n' "$PREVIEW_DIR"
fi

echo '[polar-visual] Static checks only; authorized session QA is a separate step.'
