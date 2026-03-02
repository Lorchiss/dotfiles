# Workflow diario: Hyprland + AGS + Kitty (2 monitores)

Guia corta para operar sin pensar demasiado.

## Mapa base de workspaces

- Monitor principal (code/build):
  - `1`: code
  - `2`: build terminal
  - `3`: terminal auxiliar
  - `4`: git/tests
  - `5`: misc dev
- Monitor secundario (docs/chat/music):
  - `6`: docs/browser
  - `7`: chat
  - `8`: music
  - `9`: misc contexto

Bootstrap automatico en login:

- `~/.config/hypr/scripts/bootstrap-workspaces.sh`

Override opcional de monitores (por nombre de salida Hyprland):

- `HYPR_PRIMARY_MONITOR=<monitor>`
- `HYPR_SECONDARY_MONITOR=<monitor>`

## Keymap diario

- Apps:
  - `SUPER + ENTER`: terminal (`kitty`)
  - `SUPER + B`: browser
  - `SUPER + D`: launcher
  - `SUPER + C`: AGS control center
- Ventanas/sesion:
  - `SUPER + Q`: cerrar ventana
  - `ALT + F4`: cerrar ventana
  - `SUPER + SHIFT + Q`: salir de Hyprland
- Monitores/workspaces:
  - `SUPER + TAB`: cambiar foco al siguiente monitor
  - `SUPER + SHIFT + TAB`: re-aplicar layout de workspaces por monitor
  - `SUPER + 1..9`: ir a workspace
  - `SUPER + SHIFT + 1..9`: mover ventana a workspace
- Multimedia (global, via `playerctl`):
  - `XF86AudioStop`: stop
  - `XF86AudioPrev`: previous
  - `XF86AudioPlay` / `XF86AudioPause`: play/pause
  - `XF86AudioNext`: next

## Kitty: seleccionar = copiar

En `kitty.conf`:

- `copy_on_select yes`
- `mouse_map middle release ungrabbed paste_from_selection`
- `mouse_map right press ungrabbed paste_from_clipboard`

Resultado:

- Seleccion con mouse copia automaticamente.
- Pegado por seleccion primaria con click medio.
- Pegado por clipboard con click derecho (y atajos normales siguen igual).

## Smoke test rapido

1. Recargar Hyprland:
   - `hyprctl reload`
2. Reaplicar layout manual (si conectaste/desconectaste monitor):
   - `~/.config/hypr/scripts/bootstrap-workspaces.sh`
3. Verificar AGS:
   - `systemctl --user status ags.service`
4. Smoke completo AGS:
   - `bash bootstrap/ags-smoke.sh`
5. Probar multimedia:
   - `playerctl play-pause`
   - luego teclas multimedia fisicas

## Rollback simple

Si quieres deshacer solo este workflow nuevo:

1. Ver commits recientes:
   - `git log --oneline -n 6`
2. Revertir los 4 commits del workflow (del mas nuevo al mas viejo):
   - `git revert --no-edit <commit_doc> <commit_workspace> <commit_kitty> <commit_keybinds>`

Rollback de emergencia sin commit:

- `git restore config/hypr/conf.d/50-binds.conf config/kitty/kitty.conf config/hypr/conf.d/90-autostart.conf config/hypr/scripts/bootstrap-workspaces.sh README.md docs/workflow-diario.md`
