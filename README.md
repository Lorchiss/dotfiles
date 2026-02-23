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

## Preflight recomendado

Antes de desplegar, valida dependencias:

- `bootstrap/check-deps.sh`

Esto reporta comandos clave para que la barra/popup funcionen correctamente (playerctl, pactl, iw, etc.).

## Calidad AGS (typecheck/lint)

En `config/ags` ahora tienes scripts para validación:

- `npm run typecheck`
- `npm run lint`
- `npm run format`

Sugerencia rápida:

```bash
cd config/ags
npm install
npm run typecheck
npm run lint
```

## Recuperación rápida de `ags.service`

Si ves `start-limit-hit`, ejecuta:

```bash
systemctl --user daemon-reload
systemctl --user reset-failed ags.service
systemctl --user restart ags.service
journalctl --user -u ags.service -n 120 --no-pager
```

Con el servicio actualizado se evita conflicto por instancias duplicadas y se limita el reinicio automático a fallos anómalos.
