---
applyTo: "config/quickshell/**,config/systemd/user/quickshell*.service,bootstrap/quickshell-check.sh"
---

# Quickshell runtime instructions

## Runtime boundary

- Quickshell is canonical since the 2026-09-06 startup recovery decision.
- Start `quickshell.service` through `start-desktop-shell.sh` after importing
  the Hyprland environment. Do not add a second default.target startup path.
- Keep canonical, legacy prototype, AGS and Waybar mutually exclusive.
- Keep AGS as manual/failure recovery; do not enable it at login.
- Do not modify AGS as part of a Quickshell change unless the user explicitly
  requests cross-runtime work.

## QML contract

- Target the packaged Quickshell `0.3.x` API.
- Use `ShellRoot`, one `PanelWindow` per `Quickshell.screens` entry, and
  `Hyprland.monitorFor(screen)` for monitor ownership.
- Use `import qs` module paths and Quickshell-synthesized modules; do not add
  manual `qmldir` files.
- Centralize visual tokens in `config/quickshell/Theme.qml`.
- Prefer native Hyprland and Quickshell services over recurring shell commands.
- Preserve readable fallback content when a service or active window is absent.

## Validation

- Always run `bash bootstrap/quickshell-check.sh`.
- Run semantic QML validation only when Quickshell is installed.
- Starting/stopping either shell is a live-session mutation and requires
  explicit authorization.
