# AGS Module Architecture (Bar + Popups)

## 1) Data/render contract

- Todo texto dinámico visible debe pasar por `safeText(value, fallback, module, field)`.
- `safeText` bloquea y reemplaza contenido técnico/no apto UI:
  - `[object`
  - `instance wrapper`
  - `Gtk.`
  - `GObject`
  - `native@`
  - `Accessor`
  - `undefined`
  - `null`
- En `DEBUG_BAR=1`, cada bloqueo se loguea con módulo/campo para diagnóstico.

## 2) Visual consistency

- Tokens y look & feel centralizados en `config/ags/style.scss`.
- Estados inline de `ControlCenter` normalizados vía `config/ags/lib/uiFeedback.ts`:
  - clase success/error consistente
  - prefijo busy (`⏳`) consistente

## 3) Overlay composition (Spotify / ControlCenter / CommandPalette)

- Orquestación central en `config/ags/lib/overlayOrchestrator.ts`.
- Reglas:
  - `command-palette` tiene prioridad y evita competencia visual.
  - `control-center` y `spotify` usan layout dinámico `side` o `stack` según espacio.
  - Monitor objetivo sincronizado por monitor enfocado.

## 4) Quality gate

- Gate único recomendado: `bash bootstrap/qa.sh`
- Incluye:
  - restart limpio `ags.service`
  - `bootstrap/ags-smoke.sh`
  - scan de logs runtime con patrones prohibidos
  - validación UX/static (`bootstrap/qa-visual.sh`)

## 5) Troubleshooting flow (5 pasos)

1. Ejecutar `DEBUG_BAR=1` + `bash bootstrap/bar-diagnose.sh`.
2. Identificar primer módulo que introduce error.
3. Corregir en módulo afectado respetando `safeText`.
4. Ejecutar `bash bootstrap/qa.sh`.
5. Solo desplegar si `qa.sh` y `ags-smoke.sh` terminan en PASS.
