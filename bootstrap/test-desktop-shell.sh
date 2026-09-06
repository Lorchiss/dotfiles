#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER="$REPO_DIR/config/hypr/scripts/start-desktop-shell.sh"
TEST_DIR="$(mktemp -d -t dotfiles-shell-test.XXXXXX)"
trap 'rm -rf "$TEST_DIR"' EXIT
export SHELL_TEST_TRACE="$TEST_DIR/trace"

# Exported mocks ensure no case can start services or contact the real shell.
systemctl() {
  printf 'systemctl %s\n' "$*" >>"$SHELL_TEST_TRACE"
  case "$*" in
    '--user import-environment '*) [[ "${SHELL_TEST_IMPORT_FAIL:-0}" == 0 ]] ;;
    '--user start quickshell.service') [[ "${SHELL_TEST_START_FAIL:-0}" == 0 ]] ;;
    *) return 0 ;;
  esac
}
dbus-update-activation-environment() { printf 'dbus %s\n' "$*" >>"$SHELL_TEST_TRACE"; }
quickshell() {
  printf 'quickshell %s\n' "$*" >>"$SHELL_TEST_TRACE"
  [[ "${SHELL_TEST_IPC_FAIL:-0}" == 0 ]]
}
timeout() { shift; "$@"; }
sleep() { :; }
export -f systemctl dbus-update-activation-environment quickshell timeout sleep

run_case() {
  local expected="$1" actual=0
  shift
  : >"$SHELL_TEST_TRACE"
  env WAYLAND_DISPLAY=wayland-test HYPRLAND_INSTANCE_SIGNATURE=test \
    "$@" bash "$LAUNCHER" >"$TEST_DIR/output" 2>&1 || actual=$?
  if [[ "$actual" != "$expected" ]]; then
    printf '[shell-test] Expected exit %s, got %s\n' "$expected" "$actual" >&2
    exit 1
  fi
}

run_case 0
awk '
  /^systemctl --user import-environment / { imported=1 }
  /^systemctl --user start quickshell.service$/ { if (!imported) exit 1; started=1 }
  END { if (!started) exit 1 }
' "$SHELL_TEST_TRACE"
! grep -q 'start ags.service' "$SHELL_TEST_TRACE"

run_case 1 SHELL_TEST_START_FAIL=1
awk '
  /^systemctl --user stop quickshell.service quickshell-prototype.service$/ { stopped=1 }
  /^systemctl --user start ags.service$/ { if (!stopped) exit 1; restored=1 }
  END { if (!restored) exit 1 }
' "$SHELL_TEST_TRACE"

run_case 1 SHELL_TEST_IMPORT_FAIL=1
! grep -q -- '--user start' "$SHELL_TEST_TRACE"

run_case 1 WAYLAND_DISPLAY=
[[ ! -s "$SHELL_TEST_TRACE" ]]

: >"$SHELL_TEST_TRACE"
bash "$LAUNCHER" --wait
! grep -q 'systemctl' "$SHELL_TEST_TRACE"
if SHELL_TEST_IPC_FAIL=1 bash "$LAUNCHER" --wait >"$TEST_DIR/output" 2>&1; then
  printf '%s\n' '[shell-test] Missing IPC must fail readiness.' >&2
  exit 1
fi

printf '%s\n' '[shell-test] PASS: ordered startup, fallback, missing environment and IPC readiness'
