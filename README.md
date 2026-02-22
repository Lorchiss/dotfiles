# Dotfiles overview

Este repositorio configura un entorno de escritorio Linux centrado en **Hyprland + AGS**.

## Qué hace hoy

- `bootstrap/deploy.sh`: despliega symlinks de `config/*` a `~/.config/*`, hace backup y habilita `ags.service` de systemd usuario.
- `config/hypr`: configuración modular de Hyprland en `conf.d/*`.
- `config/ags`: barra/popup escritos en TypeScript + SCSS para AGS (clock, red, volumen, controles Spotify).
- `config/kitty`, `config/rofi`: ajustes de terminal y launcher.
- `config/systemd/user/ags.service`: servicio de usuario para arrancar AGS.

## Cómo validar rápido

1. Ejecutar `bootstrap/deploy.sh`.
2. Confirmar servicio AGS:
   - `systemctl --user status ags.service`
3. Revisar logs:
   - `journalctl --user -u ags.service -f`

## Próximas mejoras sugeridas

- Arreglar inconsistencias en `config/ags/widget/Bar.tsx` (por ejemplo, referencias no definidas).
- Añadir script de lint/typecheck para AGS.
- Documentar dependencias de runtime: `playerctl`, `pactl`, `iw`, `ip`, `free`.
