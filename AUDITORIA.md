# Auditoría técnica del repositorio dotfiles

Fecha original: 2026-02-21  
Actualización: 2026-02-22

## Estado actual (auditoría incremental)

Se revisó nuevamente el stack Hyprland + AGS tras los cambios recientes del bar/popup.

### ✅ Resuelto desde la auditoría anterior

- Barra modularizada en componentes (`SpotifyButton`, `SystemMetrics`, `ClockMenu`, `VolumeControl`).
- Se eliminó el estado no definido (`spotifyState`) que rompía el render.
- La barra reserva espacio correcto (exclusividad/layer).
- Se corrigió la métrica RAM (`RAM X%`) y ya no queda en placeholder por formato de `%`.
- Se reemplazaron placeholders de barra por datos reales:
  - workspace activo
  - ventana activa

### ⚠️ Hallazgos relevantes pendientes / ajuste fino

#### P1 — UX/fluidez del popup Spotify

1. **El progreso puede percibirse con saltos**
   - Causa: actualización por polling (no señal push de progreso continuo).
   - Estado actual: suavizado con transición CSS.
   - Siguiente mejora: interpolación local de progreso entre polls para movimiento continuo.

2. **Escala visual del popup sensible al gusto**
   - Causa: múltiples iteraciones de tamaño (card/caratula/tipografía).
   - Estado actual: proporciones ajustadas y más compactas.
   - Siguiente mejora: definir presets (`compact`, `balanced`, `hero`) y conmutar por variable SCSS.

3. **Apertura Spotify por doble click depende del binario/app launcher disponible**
   - Estado actual: fallback en cadena `spotify` -> `gtk-launch spotify` -> `xdg-open spotify:`.
   - Siguiente mejora: detectar método válido al iniciar y cachear preferencia.

#### P2 — Operación/robustez general

4. **No existe chequeo de dependencias de sesión**
   - Falta script de preflight para validar `playerctl`, `pactl`, `iw`, `ip`, `hyprctl`, etc.

5. **No hay typecheck/lint automatizado para AGS**
   - Riesgo: regresiones de TS/JSX detectadas tarde.

6. **Autostart referencia script externo no versionado**
   - `~/.config/scripts/wallpaper.sh` sigue fuera del repositorio.

## Plan recomendado (continuar planificado)

### Fase siguiente (corta)

1. Añadir `bootstrap/check-deps.sh` con salida clara (OK/WARN/FAIL).
2. Añadir scripts de `typecheck`/`lint` para `config/ags`.
3. Normalizar tamaños del popup con tokens SCSS (`$popup-width`, `$cover-size`, etc.).

### Fase siguiente+ (opcional)

4. Interpolación de progreso (movimiento más continuo entre polls).
5. Presets visuales del popup (compact/balanced/hero).

## Comandos usados en esta actualización

- `sed -n '1,260p' AUDITORIA.md`
- `sed -n '1,260p' config/ags/widget/Bar.tsx`
- `sed -n '1,320p' config/ags/widget/Spotify.tsx`
- `sed -n '1,260p' config/ags/widget/bar/SystemMetrics.tsx`
- `sed -n '1,260p' config/ags/widget/bar/SpotifyButton.tsx`
- `sed -n '1,260p' config/ags/style.scss`

