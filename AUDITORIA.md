# Auditoria tecnica del repositorio dotfiles

Fecha original: 2026-02-21  
Ultima actualizacion: 2026-02-23 (ajuste de proporcion de barra)

## Resumen ejecutivo

- Estado general: estable en estructura y modularizacion de AGS.
- Problema visual principal: proporcion horizontal de la barra desbalanceada hacia el bloque derecho.
- Cobertura de validacion: parcial (falta validacion visual en sesion Wayland real).

## Hallazgos confirmados

### Cerrado

1. Barra modularizada (`SpotifyButton`, `SystemMetrics`, `ClockMenu`, `VolumeControl`).
2. Error de estado no definido en bar eliminado.
3. Reserva de espacio del bar corregida (`layer` + `exclusivity`).
4. RAM funcional (`RAM X%`) sin `%` duplicado.
5. Datos reales en barra (workspace y ventana activa).
6. Preflight agregado (`bootstrap/check-deps.sh`).
7. Scripts de calidad AGS agregados (`typecheck`, `lint`, `format`).
8. `ags.service` endurecido para evitar loops de reinicio.

### Abierto / en seguimiento

1. **P1 - Proporcion visual de barra**
   - Evidencia: anchos minimos anteriores del bloque derecho eran altos y producian barra visualmente cargada.
   - Accion aplicada: presets SCSS de densidad (`compact`, `balanced`, `hero`) + ajuste de anchos en modo `balanced`.
   - Estado: corregido a nivel de codigo; pendiente validacion visual en sesion real.

2. **P2 - Dependencias de runtime incompletas**
   - `bootstrap/check-deps.sh` reporta faltante `iw`.
   - Impacto: metrica Wi-Fi puede quedar en `NET --`.

3. **P2 - Validacion de calidad incompleta en esta maquina**
   - `npm run typecheck` no ejecuto por ausencia de `tsc` en entorno local.
   - Falta ejecutar `npm install` en `config/ags` y repetir typecheck/lint.

4. **P3 - Documentacion desalineada**
   - `README.md` aun lista como "proximas mejoras" items ya resueltos.
   - Conviene sincronizar README con el estado actual de esta auditoria.

5. **P3 - Recurso externo fuera de repo**
   - `~/.config/scripts/wallpaper.sh` sigue no versionado.

## Cambios aplicados en esta actualizacion

1. `config/ags/style.scss`
   - Se agrego sistema de presets de proporcion:
     - `compact`
     - `balanced` (default)
     - `hero`
   - Se ajustaron anchos minimos de chips y espaciados para mejorar balance visual.

2. `config/ags/widget/bar/SpotifyButton.tsx`
   - `maxWidthChars` del label de Spotify: `20 -> 16` para reducir peso visual del bloque derecho.

## Lo que falta para cerrar auditoria

1. Validar visualmente la barra en Wayland real (desktop normal, no headless).
2. Si aun se ve desproporcionada, cambiar preset en `config/ags/style.scss` (`$bar-density` a `compact` o `hero`).
3. Instalar `iw` para telemetria Wi-Fi completa.
4. Ejecutar en `config/ags`:
   - `npm install`
   - `npm run typecheck`
   - `npm run lint`
5. Alinear `README.md` con estado actual.

## Comandos usados en esta revision

- `nl -ba AUDITORIA.md`
- `nl -ba config/ags/style.scss`
- `nl -ba config/ags/widget/Bar.tsx`
- `nl -ba config/ags/widget/bar/SpotifyButton.tsx`
- `nl -ba config/ags/widget/bar/SystemMetrics.tsx`
- `bash bootstrap/check-deps.sh`
- `cd config/ags && npm run typecheck`

## Criterio minimo de aceptacion

- `ags.service` activo y sin reinicios en bucle.
- Barra renderizada con workspace, ventana, Spotify, metricas y reloj sin glitches visibles.
- Proporcion horizontal percibida como equilibrada en uso diario.
- Popup de Spotify funcional sin errores en logs.
