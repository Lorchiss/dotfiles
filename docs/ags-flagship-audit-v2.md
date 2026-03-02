# AGS Flagship Audit v2 (Arctic Aurora Pro)

Fecha: 2026-03-02
Alcance: `Bar`, `SpotifyPopup`, `ControlCenter`, `CommandPalette` en Arch + Hyprland + AGS

## Auditoria Dura

### P0 (Critico)

1. Colisiones de layout entre overlays
- Evidencia: `ControlCenter` y `SpotifyPopup` anclan a `TOP|RIGHT` con offsets fijos (`marginTop`/`marginRight`) sin resolver competencia.
- Impacto: superposicion, clicks perdidos y estado visual ambiguo.

2. Orquestacion inexistente de popups
- Evidencia: cada modulo abre/cierra por su cuenta (`ags toggle ...`) y no hay coordinador global de prioridad/capa.
- Impacto: comportamiento no predecible cuando se abren paneles simultaneos.

3. Keyboard-first parcial
- Evidencia: `Spotify` y `ControlCenter` solo capturan `Esc`; `CommandPalette` no tiene `Tab`, `Shift+Tab` ni atajos de navegacion de alta frecuencia consistentes.
- Impacto: friccion para uso profesional sin mouse.

### P1 (Alto)

1. Hardcodes geometricos repetidos
- Evidencia: anchos/altos/margenes en TSX (`560`, `410`, `740`, `80`, `332`, etc.) fuera de un sistema de layout.
- Impacto: baja adaptabilidad multi-monitor y deuda tecnica.

2. Jerarquia visual desigual entre modulos
- Evidencia: el peso visual de `Spotify`, `ControlCenter` y `CommandPalette` no sigue una escala comun de tipografia/densidad.
- Impacto: poca autoridad visual y mayor carga cognitiva.

3. Estados interactivos no totalmente uniformes
- Evidencia: hay mixins base, pero variaciones por modulo con diferencias no sistematicas en hover/active/focus.
- Impacto: inconsistencia perceptual y menor legibilidad de feedback.

4. Escalado limitado a una densidad de barra
- Evidencia: hay presets (`compact/balanced/hero`) pero con `hero` fijo y sin acoplar overlays al espacio disponible real del monitor activo.
- Impacto: composicion fragil en resoluciones distintas.

### P2 (Medio)

1. Polling redundante y repaints evitables
- Evidencia: multiples `createPoll` con ritmos cortos en distintos widgets sin coordinacion de estado compartido.
- Impacto: costo de repintado y jitter visual evitable.

2. Señales de estado con prioridad visual difusa
- Evidencia: alertas y mensajes inline compiten con metadata secundaria.
- Impacto: baja detectabilidad de eventos importantes en escaneo rapido.

3. Semantica de z-order no explicitada
- Evidencia: todos los popups en `Astal.Layer.TOP` sin politica declarativa.
- Impacto: orden aparente dependiente del timing de apertura.

## Arquitectura UX Objetivo

## 1) Superficie unificada (Arctic Aurora Pro v2)
- Design tokens por capas:
  - primitives: color base, alpha, sombras, radios, spacing, motion.
  - semantic: `info/success/warn/error/active/disabled/focus`.
  - component: bar, cards, chips, actions, inputs, list rows.
- Escalas consistentes:
  - spacing (4/6/8/10/12/16/20/24/32)
  - radius (8/12/16/20/pill)
  - elevation (e1/e2/e3)
  - typography (`label`, `body`, `title`, `display`)

## 2) Overlay Orchestrator
- Servicio central (`overlayOrchestrator`) que resuelve:
  - monitor activo (multi-monitor)
  - geometria dinamica por viewport
  - colisiones (`side-by-side` o `stack`)
  - prioridad de capa
- Politica de prioridad:
  1. `CommandPalette` (modo foco, bloqueante de overlays laterales)
  2. `ControlCenter` (panel operativo principal)
  3. `SpotifyPopup` (panel contextual)

## 3) Interaccion global keyboard-first
- Contrato transversal:
  - `Esc`: cerrar panel activo
  - `Tab/Shift+Tab` y `Up/Down`: navegacion consistente
  - `Enter`: accion primaria
- Atajos por modulo:
  - ControlCenter: `Left/Right` para tabs
  - Spotify: `Space`, `Left/Right`, `S`, `L`
  - CommandPalette: `Up/Down`, `Tab/Shift+Tab`, `Ctrl+J/K`

## 4) Claridad visual y densidad
- Primera lectura en 1 segundo:
  - estado actual (titulo + status)
  - accion principal (CTA dominante)
  - alerta (semantica clara)
- Reduccion de ruido:
  - menos adornos no informativos
  - separacion visual por ritmo y contraste util

## 5) Calidad y mantenibilidad
- Hardcodes migrados a tokens/layout policy.
- Reglas de fallback para casos de viewport reducido.
- Validacion final: `typecheck`, `lint`, `ags-smoke`, logs sin errores.
