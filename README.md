# Dotfiles overview

Este repositorio configura un entorno de escritorio Linux centrado en **Hyprland + AGS**.

## Qué hace hoy

- `bootstrap/deploy.sh`: despliega symlinks de `config/*` a `~/.config/*`, hace backup y habilita `ags.service` de systemd usuario.
- `config/hypr`: configuración modular de Hyprland en `conf.d/*`.
- `config/ags`: barra/popup escritos en TypeScript + SCSS para AGS (clock, red, volumen, controles Spotify).
- `config/kitty`, `config/rofi`: ajustes de terminal y launcher.
- `config/systemd/user/ags.service`: servicio de usuario para arrancar AGS.

## Identidad visual AGS (Arctic Glass)

Principios:

- Capas translúcidas en superficies (`surface-0/1/2`) con borde suave y sombra corta.
- Acentos fríos por módulo: volumen (`primary`), Spotify (`secondary`), reloj/workspace (`tertiary`), métricas en neutral.
- Contraste limpio: texto principal alto (`text-0`) y secundarios legibles (`text-1`).
- Motion sutil y breve: hover ~`0.08`, pressed ~`0.12`, transición máxima `240ms`.

Tokens clave en `config/ags/style.scss`:

- Superficies: `$ag-surface-0`, `$ag-surface-1`, `$ag-surface-2`.
- Texto: `$ag-text-0`, `$ag-text-1`.
- Acentos: `$ag-accent-primary`, `$ag-accent-secondary`, `$ag-accent-tertiary`.
- Estructura: `$ag-radius-chip`, `$ag-radius-control`, `$ag-radius-card`, `$ag-radius-pill`.
- Motion: `$ag-motion-fast`, `$ag-motion-base`, `$ag-motion-slow`, `$ag-curve-standard`.

Fase 2 (pendiente):

- Tipografías globales para reforzar identidad sin romper legibilidad del sistema.

## Big Upgrade AGS (fase 1)

Implementado:

- Workspaces por monitor en barra (`WorkspaceLanes`), con chips ocupados/activos y click para cambiar de monitor + workspace.
- Control Center lateral (`SUPER + C` o chip `Centro`) con pestañas:
  - Wi‑Fi: toggle, lista de redes, connect/disconnect y fallback `nmtui`.
  - Bluetooth: power/scan, pair+trust/connect/disconnect/remove y fallback `blueman-manager`.
  - Audio: selección de sink/source por defecto y acceso a `pavucontrol`.
  - Sesión: acciones de logout/suspend/reboot/shutdown con confirmación.
- Se mantiene compatibilidad con los módulos ya estables (volumen, Spotify, binds multimedia y screenshots).

## Mantenimiento Arch en pestaña `Sistema`

Implementado:

- Actualizaciones con breakdown `Oficial + AUR + Total`.
- Botón `Noticias` para abrir Arch News oficial y marcar leído.
- Indicadores rápidos en barra (`SystemTray`) para `AUR` y `NEWS`.
- Detección de `snapper` (config `root`) y acceso a rollback interactivo.
- Estado de batería/energía con fallback limpio en desktops sin batería.
- Flujo de actualización interactivo con snapshots pre/post (`pacman` + `paru` cuando existe).

Scripts nuevos:

- `config/ags/scripts/system_update.sh`
- `config/ags/scripts/snapper_rollback.sh`

Uso rápido:

```bash
bash config/ags/scripts/system_update.sh --dry-run
bash config/ags/scripts/snapper_rollback.sh --help
```

Notas de operación:

- Snapshots solo se ejecutan si `snapper` está instalado y existe config `root`.
- Si `paru` no existe, el update corre solo paquetes oficiales (`pacman`).
- En equipos sin batería, `Sistema` muestra estado `No disponible (desktop)` sin error.

## Contrato de dependencias (preflight)

`bootstrap/check-deps.sh` separa dependencias en dos grupos:

Required (bloquean operación estable si faltan):

- `hyprctl`, `ags`, `systemctl`
- `playerctl`, `pactl`, `ip`, `awk`
- `curl`, `python3`, `xdg-open`, `notify-send`
- `nmcli`, `bluetoothctl`

Optional (no bloquean arranque, pero degradan funciones):

- `iw`
- `nm-applet`, `blueman-applet`
- `wpctl`, `pavucontrol`
- `nmtui`, `blueman-manager`
- `grim`, `slurp`
- `powerprofilesctl`
- `checkupdates`
- `snapper`, `btrfs`
- `paru`

Modo estricto:

- `bash bootstrap/check-deps.sh --strict`

En modo estricto, el script retorna `1` si falta cualquier dependencia `required`.

## Spotify Like API (PKCE)

El popup de Spotify ahora incluye:

- Layout `Arctic+Bold` con portada dominante (520px).
- Controles extra: `Abrir`, `Shuffle`, `Like`.
- Botón `Conectar` para enlazar Spotify Web API y guardar favoritos reales.
- Acento dinámico suave calculado desde la portada del álbum.

### Setup (una sola vez)

1. Crea credenciales locales desde el ejemplo:

```bash
cp ~/.config/ags/private/spotify-auth.example.json ~/.config/ags/private/spotify-auth.json
chmod 600 ~/.config/ags/private/spotify-auth.json
```

2. Edita `~/.config/ags/private/spotify-auth.json` y define tu `client_id`.

3. En tu Spotify App Dashboard, agrega este Redirect URI exacto:

- `http://127.0.0.1:8898/callback`

4. Reinicia AGS (`systemctl --user restart ags.service`) o recarga tu sesión.

5. En el popup de Spotify, usa `Conectar` y completa el login en navegador.

### Archivos relevantes

- Helper TS: `config/ags/lib/spotifyApi.ts`
- Helper Python: `config/ags/scripts/spotify_api.py`
- Estado local OAuth: `~/.config/ags/private/spotify-auth.json` (ignorado por git)

## Cómo validar rápido

1. Validar required antes de desplegar:
   - `bash bootstrap/check-deps.sh --strict`
2. Ejecutar `bootstrap/deploy.sh`.
3. Confirmar servicio AGS:
   - `systemctl --user status ags.service`
4. Revisar logs:
   - `journalctl --user -u ags.service -f`

## Estado de auditoría actual

Estado: `cerrada` (auditoría de estabilidad cerrada el 2026-02-23).

Resultado:

- Dependencias `required` en verde y `optional` con faltantes esperados de mantenimiento (`snapper`, `btrfs`, `paru`) según host.
- `ags.service` activo y estable tras reinicio.
- Validación visual en Wayland real completada (barra, Control Center y Spotify popup).
- `typecheck` y `lint` de AGS en verde.

## Preflight recomendado

Antes de desplegar, valida dependencias:

- `bash bootstrap/check-deps.sh --strict` (bloquea faltantes `required`)
- `bash bootstrap/check-deps.sh` (reporte completo `required + optional`)

Esto reporta comandos clave para que barra/control center funcionen sin degradación.

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

## Smoke test operativo AGS

Para validar runtime después de cambios:

```bash
bash bootstrap/ags-smoke.sh
```

El smoke test:

- reinicia `ags.service`
- fuerza `Control Center` en tab `Sistema` y abre/cierra panel
- ejecuta validaciones seguras de scripts:
  - `system_update.sh --dry-run`
  - `snapper_rollback.sh --help`
- abre/cierra popup de Spotify
- falla (`exit 1`) si detecta `JS ERROR`, `TypeError`, `Traceback`, `CRITICAL` o `ERROR` en logs recientes

## Recuperación rápida de `ags.service`

Si ves `start-limit-hit`, ejecuta:

```bash
systemctl --user daemon-reload
systemctl --user reset-failed ags.service
systemctl --user restart ags.service
journalctl --user -u ags.service -n 120 --no-pager
```

Con el servicio actualizado se evita conflicto por instancias duplicadas y se limita el reinicio automático a fallos anómalos.
