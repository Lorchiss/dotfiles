# Dotfiles overview

Este repositorio configura un entorno de escritorio Linux centrado en **Hyprland + AGS**.

## Qué hace hoy

- `bootstrap/deploy.sh`: despliega symlinks de `config/*` a `~/.config/*`, hace backup y habilita `ags.service` de systemd usuario.
- `config/hypr`: configuración modular de Hyprland en `conf.d/*`.
- `config/hypr/scripts/window-session.py`: snapshot/restore de ventanas por workspace persistente entre sesiones.
- `config/ags`: barra/popup escritos en TypeScript + SCSS para AGS (clock, red, volumen, controles Spotify).
- `config/kitty`, `config/rofi`: ajustes de terminal y launcher.
- `config/systemd/user/ags.service`: servicio de usuario para arrancar AGS.

## Workflow diario (2 monitores)

- Guía práctica: `docs/workflow-diario.md`
- Incluye: estrategia de workspaces por monitor, keymap diario, multimedia global con `playerctl`, Kitty `copy_on_select`, smoke test y rollback simple.

## Persistencia de ventanas (Hyprland)

Implementado:

- Snapshot automático cada `20s` y save final al cerrar sesión (`window-session-daemon.sh`).
- Restore automático al login desde `~/.local/state/hypr/window-session.json`.
- Restaura cantidad de ventanas, app y workspace.
- Fallback: si no hay snapshot válido, aplica bootstrap base (`code`, `kitty`, `firefox`, `spotify`).

Comandos manuales:

```bash
python3 ~/.config/hypr/scripts/window-session.py save
python3 ~/.config/hypr/scripts/window-session.py restore
```

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

## Observabilidad barra AGS

Feature flags por módulo (default `ON`):

- `BAR_WS`
- `BAR_ACTIVE_WINDOW`
- `BAR_SPOTIFY`
- `BAR_HEALTH`
- `BAR_MAINTENANCE`
- `BAR_CLOCK`
- `BAR_AUDIO`
- `BAR_CONNECTIVITY`

Debug global:

- `DEBUG_BAR=1` habilita logs por módulo con prefijo:
  - `[BAR:WS]`
  - `[BAR:ACTIVE_WINDOW]`
  - `[BAR:SPOTIFY]`
  - `[BAR:HEALTH]`
  - `[BAR:MAINTENANCE]`
  - `[BAR:CLOCK]`
  - `[BAR:AUDIO]`
  - `[BAR:CONNECTIVITY]`

Ejemplo de uso manual:

```bash
systemctl --user set-environment DEBUG_BAR=1 BAR_SPOTIFY=0 BAR_HEALTH=0
systemctl --user restart ags.service
journalctl --user -u ags.service -n 120 --no-pager | rg "\\[BAR:"
```

Diagnóstico incremental automático:

```bash
bash bootstrap/bar-diagnose.sh
```

Secuencia recomendada de aislamiento:

1. Todo OFF.
2. Activar módulo 1.
3. Revisar logs.
4. Activar siguiente módulo.
5. El primer módulo que rompe es el sospechoso.

Arquitectura de módulos (bar + popups):

- `docs/ags-modules-architecture.md`

## QA estricto bloqueante (fail-fast)

Comando único recomendado antes de commit/deploy:

```bash
bash bootstrap/qa.sh
```

`bootstrap/qa.sh` ejecuta en orden:

1. Restart limpio de `ags.service`.
2. Smoke test operativo (`bootstrap/ags-smoke.sh`).
3. Escaneo de logs recientes de `ags.service` con `journalctl`.
4. Gate UX/static (`bootstrap/qa-visual.sh`) cuando está disponible.

Patrones bloqueantes por defecto:

- `No property named`
- `assertion failed`
- `instance wrapper`
- `[object`
- `Accessor`
- `TypeError`
- `Traceback`
- `CRITICAL`

Flags:

- `--strict` habilita bloqueo por patrones (default).
- `--no-strict` reporta patrones sin bloquear (solo diagnóstico).
- `--logs N` ajusta cuántas líneas recientes de logs se escanean.
- `--skip-visual` omite el gate UX/static.

Ejemplo PASS:

```text
[qa] step 1/4: clean restart ags.service
[qa] step 2/4: run smoke test
[ags-smoke] PASS
[qa] step 3/4: scan ags.service logs (last 300 lines)
[qa] step 4/4: run UX/static visual gate
[qa] PASS: runtime + UX gate clean
```

Ejemplo FAIL:

```text
[qa] step 3/4: scan ags.service logs (last 300 lines)
[qa] BLOCKER pattern detected: No property named (2 matches)
[qa]   44:CSS Error :241:3 No property named "max-width"
[qa]   45:CSS Error :1633:3 No property named "align-items"
[qa] FAIL: prohibited runtime patterns detected (2 matches)
```

Hook pre-commit opcional (no forzado):

```bash
cat > .git/hooks/pre-commit <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
bash bootstrap/qa.sh
EOF
chmod +x .git/hooks/pre-commit
```

Modo autofix loop (opcional):

```bash
bash bootstrap/qa-autofix.sh
```

El loop corre `bootstrap/qa.sh` como gate obligatorio y, si falla, intenta fixes mínimos por prioridad:

1. `P0`: crash/assertion/TypeError
2. `P1`: CSS GTK inválido (`No property named`)
3. `P2`: texto basura visible (`[object`, `instance wrapper`)

Política del loop:

- máximo 5 iteraciones (configurable con `--max-iterations N`)
- reintento con `bash bootstrap/qa.sh` después de cada patch
- si el mismo patrón falla 2 veces, cambia de estrategia automáticamente

## Recuperación rápida de `ags.service`

Si ves `start-limit-hit`, ejecuta:

```bash
systemctl --user daemon-reload
systemctl --user reset-failed ags.service
systemctl --user restart ags.service
journalctl --user -u ags.service -n 120 --no-pager
```

Con el servicio actualizado se evita conflicto por instancias duplicadas y se limita el reinicio automático a fallos anómalos.
