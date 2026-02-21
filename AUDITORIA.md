# Auditoría técnica del repositorio dotfiles

Fecha: 2026-02-21

## Alcance

Se auditó la estructura y consistencia de:

- `bootstrap/deploy.sh`
- `config/hypr/**`
- `config/ags/**`
- `config/systemd/user/ags.service`
- `config/kitty/**`
- `config/rofi/**`

## Resumen ejecutivo

El repositorio está bien encaminado y tiene una estructura clara por componentes. Sin embargo, hay **un bloqueo funcional crítico** en AGS (barra) por referencias no definidas, y varias dependencias/runtime no verificadas que pueden romper la experiencia al desplegar en una máquina nueva.

Prioridad sugerida:

1. Corregir AGS (`Bar.tsx`) para evitar fallo de render.
2. Añadir chequeo mínimo post-deploy de dependencias y servicio.
3. Documentar un flujo de validación reproducible (lint/typecheck/smoke checks).

## Hallazgos

### P0 (crítico)

1. **`spotifyState` no está definido en `Bar.tsx`** pero se utiliza en el JSX.
   - Impacto: AGS puede fallar al compilar/renderizar la barra.
   - Evidencia: uso de `spotifyState.playing` y `spotifyState.title` sin declaración local/import.
   - Acción: reemplazar por `spotifyTitle` (ya existe como poll) o introducir estado reactivo real.

### P1 (alto)

2. **`cpu` se calcula pero no se muestra en la barra**.
   - Impacto: inconsistencia funcional (se espera CPU/RAM/NET/VOL).
   - Acción: añadir `<label label={cpu} />` o eliminar poll si no se usará.

3. **Autostart referencia un script no versionado en este repo**: `~/.config/scripts/wallpaper.sh`.
   - Impacto: warning/ruido al iniciar sesión en instalaciones nuevas.
   - Acción: versionar script o proteger llamada con check de existencia.

4. **Dependencias externas no validadas** (`playerctl`, `pactl`, `iw`, `ip`, `free`, `nm-applet`, `blueman-applet`, `grim`, `slurp`).
   - Impacto: múltiples widgets/binds pueden quedar degradados silenciosamente.
   - Acción: añadir script `bootstrap/check-deps.sh` y documentar paquetes por distro.

### P2 (medio)

5. **`bootstrap/deploy.sh` no verifica que `systemctl --user` esté disponible**.
   - Impacto: en entornos sin sesión systemd usuario falla parcialmente (aunque `enable --now` tiene `|| true`).
   - Acción: condicionar `daemon-reload`/`enable` a disponibilidad de `systemctl --user`.

6. **No hay comandos de calidad para AGS** (typecheck/lint).
   - Impacto: errores de TS/JSX detectados tarde.
   - Acción: agregar scripts en `package.json` (`typecheck`, `lint`) y flujo de validación.

7. **Reglas/comentarios de Hyprland mezclan advertencias de compatibilidad sin detección de versión**.
   - Impacto: configuración frágil entre versiones de Hyprland.
   - Acción: documentar versión objetivo o variantes por versión.

### P3 (bajo)

8. **Ausencia de documentación operativa detallada** (rollback, troubleshooting, checklist post-update).
   - Acción: ampliar README con sección “runbook”.

## Plan de acción recomendado

### Fase 1 (rápida, 30-60 min)

- Corregir `Bar.tsx` (estado Spotify + mostrar CPU).
- Añadir validación mínima de dependencias críticas.
- Añadir comandos de verificación en README.

### Fase 2 (1-2 h)

- Añadir `typecheck` AGS y hacer pasar compilación.
- Endurecer `deploy.sh` para entornos sin `systemd --user`.
- Incluir `wallpaper.sh` o convertirlo en opcional seguro.

### Fase 3 (opcional)

- Añadir tema/estilos desacoplados por módulos (bar/popup/launcher).
- Añadir script de smoke test de sesión (comprobación de binarios + servicio + logs recientes).

## Comandos usados en la auditoría

- `rg --files`
- `sed -n '1,220p' bootstrap/deploy.sh`
- `sed -n '1,220p' config/hypr/hyprland.conf`
- `sed -n '1,220p' config/hypr/conf.d/*.conf`
- `sed -n '1,220p' config/ags/*.ts* config/ags/widget/*.tsx config/ags/style.scss`
- `sed -n '1,220p' config/systemd/user/ags.service`
- `sed -n '1,220p' config/kitty/kitty.conf config/rofi/config.rasi`
- `rg -n "spotifyState|createPoll\(|exec-once|wallpaper\.sh|windowrulev|ags toggle" config`
- `bash -n bootstrap/deploy.sh`

