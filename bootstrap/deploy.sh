#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG_DIR="$REPO_DIR/config"
BACKUP_DIR="$HOME/.config/.backup-dotfiles-$(date +%F_%H%M%S)"

mkdir -p "$BACKUP_DIR"

link_dir() {
  local src="$1"
  local dst="$2"

  if [[ -e "$dst" && ! -L "$dst" ]]; then
    echo "[backup] $dst -> $BACKUP_DIR/"
    mv "$dst" "$BACKUP_DIR/"
  elif [[ -L "$dst" ]]; then
    echo "[unlink] $dst"
    rm "$dst"
  fi

  echo "[link] $src -> $dst"
  ln -s "$src" "$dst"
}

mkdir -p "$HOME/.config"

link_dir "$CFG_DIR/hypr"  "$HOME/.config/hypr"
link_dir "$CFG_DIR/kitty" "$HOME/.config/kitty"
link_dir "$CFG_DIR/rofi"  "$HOME/.config/rofi"
link_dir "$CFG_DIR/ags"   "$HOME/.config/ags"

echo "[ags] using system package (no npm install)"
echo "[done] Backup at: $BACKUP_DIR"
