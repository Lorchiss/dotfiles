# Auditoría técnica del repositorio dotfiles

Fecha original: 2026-02-21  
Actualización: 2026-02-23 (seguimiento operativo)

## Estado actual (auditoría incremental)

Se revisó nuevamente el stack Hyprland + AGS tras estabilización de servicio, modularización del bar y ajustes del popup de Spotify.

### ✅ Resuelto desde la auditoría inicial

1. Barra modularizada (`SpotifyButton`, `SystemMetrics`, `ClockMenu`, `VolumeControl`).
2. Error por estado no definido en bar eliminado.
3. Reserva de espacio de barra corregida (layer/exclusivity).
4. RAM funcional (`RAM X%`) y sin `%` duplicado.
5. Placeholders reemplazados por datos reales:
   - workspace activo
   - ventana activa
6. Preflight de dependencias agregado (`bootstrap/check-deps.sh`).
7. Scripts de calidad AGS agregados (`typecheck`, `lint`, `format`).
8. `ags.service` endurecido para reducir loops `start-limit-hit`.

### ⚠️ Puntos relevantes actuales

#### P1 — UX del popup / barra

1. **Fluidez de progreso**
   - Estado: se mantiene progreso por polling + transición CSS para priorizar estabilidad.
   - Nota: la interpolación agresiva se descartó por riesgo de inestabilidad en runtime.

2. **Escala visual configurable**
   - Estado: popup en modo compacto/balanceado.
   - Siguiente mejora: presets por variables SCSS (`compact`, `balanced`, `hero`).

3. **Control de volumen de barra**
   - Estado: migrado a control compacto con popover (menos ruido visual).
   - Siguiente mejora opcional: slider de volumen nativo si se valida estable en AGS runtime.

#### P2 — Operación

4. **Script de wallpaper externo**
   - `~/.config/scripts/wallpaper.sh` sigue fuera del repositorio.

5. **Validación runtime real**
   - Entorno CI/headless no permite verificar AGS/Wayland visualmente.
   - Requiere smoke-test en sesión real de usuario.

## Plan recomendado (continuar planificado)

### Siguiente fase corta

1. Añadir presets SCSS del popup (`compact`, `balanced`, `hero`).
2. Documentar troubleshooting AGS en README (errores frecuentes + comandos).
3. Decidir si incorporar slider de volumen o mantener popover por simplicidad.

### Fase opcional

4. Añadir script de smoke-test post-deploy para sesión de usuario.
5. Versionar o hacer opcional seguro el `wallpaper.sh`.

## Comandos usados en esta actualización

- `sed -n '1,240p' config/ags/widget/bar/VolumeControl.tsx`
- `sed -n '1,260p' config/ags/style.scss`
- `sed -n '1,220p' AUDITORIA.md`

## Verificación rápida recomendada

Para validar el estado en una máquina de usuario (Wayland), ejecutar:

1. `systemctl --user status ags.service --no-pager`
2. `journalctl --user -u ags.service -n 80 --no-pager`
3. `cd ~/.config/ags && npm run typecheck && npm run lint`

Criterio de aceptación mínimo:

- El servicio permanece activo sin reinicios en bucle.
- El bar se renderiza con métricas (CPU/RAM), reloj y volumen funcional.
- El popup de Spotify abre/cierra sin errores visibles ni stack traces.

