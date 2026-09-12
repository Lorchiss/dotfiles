#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d -t polar-theme-test.XXXXXX)"
cleanup() { rm -rf -- "$TMP"; }
trap cleanup EXIT
export HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" XDG_STATE_HOME="$TMP/state"
export XDG_CACHE_HOME="$TMP/cache" TEST_TMP="$TMP" WAYLAND_DISPLAY=polar-test
mkdir -p "$HOME" "$XDG_CONFIG_HOME/gtk-3.0"

gsettings() { printf '%s\n' "$*" >> "$TEST_TMP/gsettings.log"; }
export -f gsettings
printf '%s\n' '# Keep my comments' '[Settings]' 'gtk-icon-theme-name=LocalIcons' \
  'gtk-font-name=Old Font 10' 'gtk-application-prefer-dark-theme=0' \
  '[Other]' 'gtk-font-name=Do Not Touch' > "$XDG_CONFIG_HOME/gtk-3.0/settings.ini"

theme() { bash "$ROOT/config/hypr/scripts/theme-sync.sh" "$@"; }
[[ "$(theme status)" == dark ]]
theme --dry-run light >/dev/null
[[ ! -e "$XDG_STATE_HOME" && ! -e "$TMP/gsettings.log" ]]
[[ ! -e "$XDG_CONFIG_HOME/kitty" ]]
[[ "$(theme dark)" == dark ]]
cmp "$ROOT/config/kitty/themes/polar-dark.conf" "$XDG_CONFIG_HOME/kitty/theme-auto.conf"
cmp "$ROOT/config/rofi/themes/polar-dark.rasi" "$XDG_CONFIG_HOME/rofi/theme-auto.rasi"
grep -q '^# Keep my comments$' "$XDG_CONFIG_HOME/gtk-3.0/settings.ini"
grep -q '^gtk-icon-theme-name=LocalIcons$' "$XDG_CONFIG_HOME/gtk-3.0/settings.ini"
grep -q '^gtk-font-name=Do Not Touch$' "$XDG_CONFIG_HOME/gtk-3.0/settings.ini"
grep -q '^gtk-font-name=IBM Plex Sans 11$' "$XDG_CONFIG_HOME/gtk-4.0/settings.ini"
grep -q '^gtk-application-prefer-dark-theme=1$' "$XDG_CONFIG_HOME/gtk-3.0/settings.ini"
before="$(stat -c '%i:%Y' "$XDG_CONFIG_HOME/kitty/theme-auto.conf")"
theme apply >/dev/null
[[ "$before" == "$(stat -c '%i:%Y' "$XDG_CONFIG_HOME/kitty/theme-auto.conf")" ]]
[[ "$(theme light)" == light ]]
cmp "$ROOT/config/kitty/themes/polar-light.conf" "$XDG_CONFIG_HOME/kitty/theme-auto.conf"
grep -q '^gtk-application-prefer-dark-theme=0$' "$XDG_CONFIG_HOME/gtk-3.0/settings.ini"
[[ "$(theme toggle)" == dark ]]
gtk_before="$(sha256sum "$XDG_CONFIG_HOME/gtk-3.0/settings.ini" "$TMP/gsettings.log")"
theme --files-only light >/dev/null
[[ "$gtk_before" == "$(sha256sum "$XDG_CONFIG_HOME/gtk-3.0/settings.ini" "$TMP/gsettings.log")" ]]
mv "$XDG_CONFIG_HOME/kitty/theme-auto.conf" "$TMP/linked-palette"
ln -s "$TMP/linked-palette" "$XDG_CONFIG_HOME/kitty/theme-auto.conf"
theme --files-only dark >/dev/null
[[ -L "$XDG_CONFIG_HOME/kitty/theme-auto.conf" ]]
cmp "$ROOT/config/kitty/themes/polar-dark.conf" "$TMP/linked-palette"
rc=0
theme dark light >/dev/null 2>&1 || rc=$?
[[ "$rc" == 2 ]]
echo '[polar-test] PASS: dry-run, dark/light/toggle, idempotence, GTK preservation and symlinks'

# Mock every desktop-facing wallpaper command. No real daemon or socket is used.
awww() {
  case "$1" in
    query)
      [[ -f "$TEST_TMP/ready" ]] || return 1
      if [[ -n "${MOCK_CURRENT_IMAGE:-}" ]]; then
        printf 'DP-1: currently displaying: image: %s\n' "$MOCK_CURRENT_IMAGE"
      fi ;;
    img)
      printf '%s\n' "$*" >> "$TEST_TMP/images.log"
      [[ "${FAIL_IMAGE:-0}" != 1 ]] ;;
    *) return 2 ;;
  esac
}
function awww-daemon {
  printf 'daemon\n' >> "$TEST_TMP/daemon-entry.log"
}
systemctl() {
  printf '%s\n' "$*" >> "$TEST_TMP/systemctl.log"
  case "$2" in
    import-environment) ;;
    start)
      [[ "${FAIL_DAEMON:-0}" != 1 ]] || return 1
      touch "$TEST_TMP/ready" ;;
    stop) rm -f "$TEST_TMP/ready" ;;
    *) return 2 ;;
  esac
}
timeout() { shift; "$@"; }
function rsvg-convert {
  [[ "${FAIL_RENDER:-0}" != 1 ]] || return 1
  [[ "$1" == --output ]] || return 2
  printf 'mock PNG\n' > "$2"
  printf 'render\n' >> "$TEST_TMP/render.log"
}
export -f awww awww-daemon systemctl timeout rsvg-convert
wallpaper() { bash "$ROOT/config/hypr/scripts/start-wallpaper.sh" "$@"; }
wallpaper --dry-run >/dev/null
[[ ! -e "$XDG_CACHE_HOME" && ! -e "$TMP/systemctl.log" ]]
wallpaper --render-only >/dev/null
[[ ! -e "$TMP/systemctl.log" && ! -e "$TMP/images.log" ]]
wallpaper --render-only >/dev/null
[[ "$(wc -l < "$TMP/render.log")" == 1 ]]
wallpaper >/dev/null
wallpaper >/dev/null
[[ "$(grep -c -- '--user start' "$TMP/systemctl.log")" == 1 ]]
QS_REDUCED_MOTION=1 wallpaper >/dev/null
grep -q -- '--transition-type none' "$TMP/images.log"
images_before="$(wc -l < "$TMP/images.log")"
MOCK_CURRENT_IMAGE="$XDG_CACHE_HOME/polar/polar-contour.png" wallpaper >/dev/null
[[ "$images_before" == "$(wc -l < "$TMP/images.log")" ]]
rm "$TMP/ready"
if FAIL_DAEMON=1 wallpaper >/dev/null 2>&1; then exit 1; fi
if FAIL_IMAGE=1 wallpaper >/dev/null 2>&1; then exit 1; fi
[[ ! -e "$TMP/ready" ]]
if WAYLAND_DISPLAY='' wallpaper >/dev/null 2>&1; then exit 1; fi
# exec intentionally bypasses shell functions, so this entry needs a PATH stub.
mkdir "$TMP/bin"
printf '%s\n' '#!/usr/bin/env bash' \
  'printf "daemon\n" >> "$TEST_TMP/daemon-entry.log"' > "$TMP/bin/awww-daemon"
chmod +x "$TMP/bin/awww-daemon"
PATH="$TMP/bin:$PATH" wallpaper --daemon
grep -q '^daemon$' "$TMP/daemon-entry.log"
echo '[polar-test] PASS: wallpaper cache, daemon reuse, reduced motion and failure cleanup'
