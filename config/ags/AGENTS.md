# Agente AGS

Estas reglas aplican a `config/ags` y sus subdirectorios.

## Contratos runtime

- Todo texto dinamico visible debe pasar por
  `safeText(value, fallback, module, field)`.
- No debe aparecer texto tecnico en UI:
  - `[object`
  - `instance wrapper`
  - `Gtk.`
  - `GObject`
  - `native@`
  - `Accessor`
  - `undefined`
  - `null`
- Los tokens visuales viven en `config/ags/style.scss`.
- Los estados de feedback se centralizan en `config/ags/lib/uiFeedback.ts`.
- La composicion de overlays vive en
  `config/ags/lib/overlayOrchestrator.ts`.
- `command-palette` tiene prioridad visual sobre otros overlays.
- `control-center` y `spotify` deben respetar el layout dinamico existente.

## Validacion esperada

- Cambios TypeScript:
  - `npm run typecheck`
  - `npm run lint`
  - `bash ../../bootstrap/ags-smoke.sh`
- Cambios SCSS/visual:
  - `npm run lint`
  - `bash ../../bootstrap/qa.sh` cuando el entorno Wayland/AGS este disponible.
- Cambios en scripts bajo `config/ags/scripts`:
  - `bash -n <script>`
  - prueba `--help` o `--dry-run` si existe.

## Reglas locales

- Mantener API y UX estables salvo instruccion explicita.
- Preferir patrones existentes antes de introducir abstracciones nuevas.
- No tocar `config/ags/private` sin confirmacion explicita.
- No declarar smoke/QA como PASS si no se ejecuto.
