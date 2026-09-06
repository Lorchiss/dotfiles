#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_DIR="$REPO_DIR/config/quickshell"
FAILURES=0

fail() {
  echo "[quickshell] FAIL: $*" >&2
  FAILURES=$((FAILURES + 1))
}

for path in \
  shell.qml \
  Theme.qml \
  Bar.qml \
  components/WorkspaceConstellation.qml \
  components/ContextRibbon.qml \
  components/SystemCluster.qml \
  components/StatusChip.qml \
  components/FocusTransferEffect.qml \
  components/MediaButton.qml \
  components/MediaCapsule.qml \
  components/TrayIcon.qml \
  components/TrayCluster.qml \
  components/TrayMenu.qml \
  components/ControlTabButton.qml \
  components/ControlCard.qml \
  components/DisplayActionButton.qml \
  components/ControlCenter.qml \
  services/FocusState.qml \
  services/AudioState.qml \
  services/NetworkState.qml \
  services/BluetoothState.qml \
  services/PowerState.qml \
  services/MediaState.qml \
  services/TrayState.qml \
  services/AlertState.qml \
  services/ControlCenterState.qml \
  services/DisplayState.qml; do
  [[ -f "$CONFIG_DIR/$path" ]] || fail "missing config/quickshell/$path"
done

grep -q '^ShellRoot {' "$CONFIG_DIR/shell.qml" || fail "shell.qml must expose ShellRoot"
grep -q '^Singleton {' "$CONFIG_DIR/Theme.qml" || fail "Theme.qml must use Quickshell Singleton"
grep -q 'model: Quickshell.screens' "$CONFIG_DIR/Bar.qml" || fail "bar must render per screen"
grep -q 'Hyprland.monitorFor' "$CONFIG_DIR/Bar.qml" || fail "bar must bind each screen to its Hyprland monitor"
grep -q 'PwObjectTracker' "$CONFIG_DIR/services/AudioState.qml" || fail "audio sink must be tracked before use"
grep -q 'SystemTray.items.values' "$CONFIG_DIR/services/TrayState.qml" \
  || fail "tray must use the native StatusNotifier model"
grep -q 'QsMenuOpener' "$CONFIG_DIR/components/TrayMenu.qml" \
  || fail "tray menus must render the native DBusMenu model"
grep -q '^PopupWindow {' "$CONFIG_DIR/components/ControlCenter.qml" \
  || fail "control center must use a native Quickshell popup"
grep -q 'Services.ControlCenterState.openFor' "$CONFIG_DIR/components/ControlCenter.qml" \
  || fail "control center instances must use the single-owner coordinator"
grep -q 'target: "polar"' "$CONFIG_DIR/shell.qml" \
  || fail "control center must expose the Polar IPC target"
grep -q 'Services.ControlCenterState.toggleFocused' "$CONFIG_DIR/shell.qml" \
  || fail "Polar IPC must target the focused monitor"
grep -q 'Services.DisplayState.applyMode' "$CONFIG_DIR/shell.qml" \
  || fail "Polar IPC must expose display recovery presets"
grep -q 'Hyprland.requestSocketPath' "$CONFIG_DIR/services/DisplayState.qml" \
  || fail "display presets must use native Hyprland IPC"
grep -q 'Quickshell.statePath("display-mode")' "$CONFIG_DIR/services/DisplayState.qml" \
  || fail "display selection must survive shell restarts"
grep -q 'Services.AudioState.setVolume' "$CONFIG_DIR/components/ControlCenter.qml" \
  || fail "control center must bind volume directly to PipeWire state"
if rg -n '\bQsMenuAnchor\b' "$CONFIG_DIR" >/dev/null; then
  fail "tray menus must use the Polar QML surface, not platform QMenu styling"
fi
grep -q 'transitionDuration: reducedMotion ? 120 : 680' "$CONFIG_DIR/services/FocusState.qml" \
  || fail "focus transfer timing contract is missing"
grep -q 'visible: !Services.FocusState.reducedMotion' "$CONFIG_DIR/components/FocusTransferEffect.qml" \
  || fail "reduced motion must disable cinematic transfer elements"
if rg -n '\b(Process|execDetached)\b' "$CONFIG_DIR/services" >/dev/null; then
  fail "native state services must not spawn external processes"
fi
if rg -n '\bNotificationServer\b' "$CONFIG_DIR" >/dev/null; then
  fail "prototype must not replace the active desktop notification daemon"
fi
grep -q 'Conflicts=ags.service' "$REPO_DIR/config/systemd/user/quickshell-prototype.service" \
  || fail "prototype service must conflict with AGS"
grep -q '^Conflicts=.*ags.service.*quickshell-prototype.service.*waybar.service' \
  "$REPO_DIR/config/systemd/user/quickshell.service" \
  || fail "canonical shell must exclude the other bars"
grep -q '^ExecStartPost=.*start-desktop-shell.sh --wait' \
  "$REPO_DIR/config/systemd/user/quickshell.service" \
  || fail "canonical shell must check IPC readiness"
grep -q '^exec-once = bash ~/.config/hypr/scripts/start-desktop-shell.sh$' \
  "$REPO_DIR/config/hypr/conf.d/90-autostart.conf" \
  || fail "Hyprland must start the canonical shell through its environment wrapper"
if rg -n '^exec(-once)?\s*=.*(ags|waybar|quickshell)' "$REPO_DIR/config/hypr/conf.d/90-autostart.conf" >/dev/null; then
  fail "autostart must not launch a second bar outside the wrapper"
fi
if rg -n '^WantedBy=' "$REPO_DIR/config/systemd/user/ags.service" \
    "$REPO_DIR/config/systemd/user/quickshell.service" \
    "$REPO_DIR/config/systemd/user/quickshell-prototype.service" >/dev/null; then
  fail "desktop shells must start from the Wayland session, not a login target"
fi
if rg -n 'enable.*ags.service' "$REPO_DIR/bootstrap/deploy.sh" >/dev/null; then
  fail "deploy must not restore AGS autostart"
fi
if [[ -L "$REPO_DIR/config/systemd/user/default.target.wants/ags.service" ]]; then
  fail "legacy AGS enablement link must not be versioned or restored"
fi

if ((FAILURES > 0)); then
  exit 1
fi

if command -v quickshell >/dev/null 2>&1; then
  echo "[quickshell] Runtime available: $(quickshell --version 2>/dev/null || echo unknown)"
else
  echo "[quickshell] SKIP runtime: quickshell is not installed"
fi

echo "[quickshell] PASS: Polar structure, startup and safety guards"
