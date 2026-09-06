# AGS Bar Flagship Audit v3

Fecha: 2026-03-02
Alcance: Bar + acople visual/operacional con SpotifyPopup, ControlCenter y CommandPalette.

## Fase 0 — Auditoria Dura

### P0 (critico)

1. Jerarquia de informacion colapsada en el extremo derecho.
- `SystemTray`, `SystemMetrics`, `ControlCenter CTA` y `Clock` compiten con peso visual casi igual.
- Impacto: el estado principal no se detecta en 1 segundo.

2. Nivel C (observabilidad secundaria) ocupa espacio de Nivel A/B.
- `UPD/AUR/NEWS/TEMP/PWR` se renderiza persistente en barra base.
- Impacto: ruido cognitivo continuo y baja señal/ruido.

3. Falta de “estado principal de ventana” en el bar.
- No hay chip persistente de contexto activo (app/titulo).
- Impacto: perdida de orientación de trabajo.

4. Politica de foco visual entre bar y overlays aun incompleta.
- Existe orquestacion de layout, pero no hay “foco visual” explicito por capa abierta.
- Impacto: cuando aparecen paneles, el bar no reduce su protagonismo de forma sistematica.

### P1 (alto)

1. Duplicidad conceptual de observabilidad.
- Estado de sistema repartido entre `SystemTray` y `SystemMetrics` sin narrativa unica.

2. Contraste y densidad de chips secundarios mejorable.
- Varios chips secundarios usan saturacion similar a chips operativos.

3. Ritmo de spacing horizontal irregular.
- Grupos no delimitados semantica/visualmente (A/B/C).

4. Motion util, pero falta motion de entrada del bar y reglas mas semanticas por nivel.

### P2 (medio)

1. Texto redundante en etiquetas secundarias (`CPU`, `RAM`, `NET`, `UPD`, etc.) para estado rapido.
2. Popovers con detalle sin “gate” claro desde summary chips.
3. Polling optimizable por consolidacion de lectura secundaria.

## Mapa de Atencion

## Actual (estimado)

- Zona izquierda:
  - `WorkspaceLanes`: 35%
- Zona centro:
  - `Spotify`: 20%
- Zona derecha:
  - `SystemTray + SystemMetrics + Centro + Clock`: 45% (demasiado distribuido)

Problema: la zona derecha absorbe demasiada atencion con datos de baja prioridad.

## Propuesto (flagship)

- Nivel A (55%):
  - Workspaces activos
  - Contexto de ventana activa
  - Hora/reloj
  - Alertas criticas (solo cuando existen)
- Nivel B (30%):
  - Audio
  - Conectividad
  - Modo operativo actual
- Nivel C (12%):
  - Resumen observabilidad (compacto)
- Nivel D (3% visible base):
  - Detalle expandible via popover/palette

Regla: Nivel C/D nunca compite visualmente con A.

## Arquitectura de Informacion (A/B/C/D)

### Nivel A (siempre visible)
- `WorkspaceLanes`
- `ActiveWindowChip` (nuevo)
- `ClockChip`
- `CriticalAlertChip` (visible solo bajo condicion real)

### Nivel B (operativo frecuente)
- `VolumeControl`
- `ConnectivityChip`
- `ModeChip` (derivado de power profile)

### Nivel C (observabilidad compacta)
- `ObservabilityChip` (nuevo resumen unico)
  - CPU/RAM/TEMP + UPD/NEWS en estado compacto

### Nivel D (on-demand)
- `ObservabilityPopover` con breakdown:
  - updates/AUR/news
  - cpu/ram/temp
  - energia/perfil
- CommandPalette mantiene atajos de mantenimiento.

## Directrices de Composicion

1. Barra base: menos texto explicito, mas codigos compactos y consistentes.
2. Popover/overlay: detalle completo, no en baseline.
3. Color:
- A > B > C en contraste y saturacion.
4. Spacing:
- Grupos con “respiracion” clara y gap fijo por nivel.

## Definition of Done UX para este ciclo

- Lectura de estado principal < 1 segundo.
- Nivel C no grita en baseline.
- Alertas reales inequívocas (solo cuando aplica).
- Bar + overlays con foco visual coherente.
