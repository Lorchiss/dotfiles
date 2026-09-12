#!/usr/bin/env bash
set -euo pipefail

usage() {
cat <<'HELP'
Usage: bootstrap/deploy.sh [options]
--dry-run Show planned actions without changes
--skip-preflight Skip strict deps check
--no-systemd Do not change running/enabled desktop shell services
HELP
}

DRY_RUN=0
SKIP_PREFLIGHT=0
NO_SYSTEMD=0

while [[ $# -gt 0 ]]; do
case "$1" in
--dry-run) DRY_RUN=1 ;;
--skip-preflight) SKIP_PREFLIGHT=1 ;;
--no-systemd) NO_SYSTEMD=1 ;;
-h|--help) usage; exit 0 ;;
*) echo "Unknown arg: $1"; exit 2 ;;
esac
shift
done

run(){ [[ "$DRY_RUN" -eq 1 ]] && echo "[dry-run] $*" || eval "$*"; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG_DIR="$REPO_DIR/config"
CHECK="$REPO_DIR/bootstrap/check-deps.sh"
BACKUP_DIR="$HOME/.config/.backup-dotfiles-$(date +%F_%H%M%S)"

if [[ "$SKIP_PREFLIGHT" -eq 0 ]]; then
bash "$CHECK" --strict
fi

run "mkdir -p '$BACKUP_DIR' '$HOME/.config'"

link_dir() {
local src="$1" dst="$2"
# Older installs link the whole systemd directory; its children already resolve here.
if [[ -e "$dst" && "$src" -ef "$dst" ]]; then
echo "[ok] $dst"
return
fi
if [[ -L "$dst" ]]; then
current="$(readlink "$dst" || true)"
[[ "$current" == "$src" ]] && { echo "[ok] $dst"; return; }
run "rm '$dst'"
elif [[ -e "$dst" ]]; then
run "mv '$dst' '$BACKUP_DIR/'"
fi
run "ln -s '$src' '$dst'"
}

link_dir "$CFG_DIR/hypr" "$HOME/.config/hypr"
link_dir "$CFG_DIR/kitty" "$HOME/.config/kitty"
link_dir "$CFG_DIR/rofi" "$HOME/.config/rofi"
link_dir "$CFG_DIR/ags" "$HOME/.config/ags"
link_dir "$CFG_DIR/quickshell" "$HOME/.config/quickshell"
# Preserve unrelated user units and enablement links.
run "mkdir -p '$HOME/.config/systemd/user'"
for unit in ags.service quickshell.service quickshell-prototype.service polar-wallpaper.service; do
link_dir "$CFG_DIR/systemd/user/$unit" "$HOME/.config/systemd/user/$unit"
done

bash "$CHECK"

if [[ "$NO_SYSTEMD" -eq 0 ]]; then
run "systemctl --user daemon-reload"
run "systemctl --user disable ags.service waybar.service"
if [[ -n "${WAYLAND_DISPLAY:-}" && -n "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]]; then
run "bash '$HOME/.config/hypr/scripts/start-desktop-shell.sh'"
else
echo "[info] Polar will start on the next Hyprland login."
fi
fi

echo "[done] backup: $BACKUP_DIR"
