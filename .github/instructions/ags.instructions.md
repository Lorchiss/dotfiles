---
applyTo: "config/ags/**"
---

# AGS instructions

These rules apply to the AGS bar, popups, Control Center, TypeScript, and SCSS.

## Runtime contracts

- All dynamic visible text must pass through `safeText(value, fallback, module,
  field)`.
- UI must not expose technical placeholder text such as `[object`,
  `instance wrapper`, `Gtk.`, `GObject`, `native@`, `Accessor`, `undefined`, or
  `null`.
- Visual tokens live in `config/ags/style.scss`.
- Feedback states are centralized in `config/ags/lib/uiFeedback.ts`.
- Overlay composition lives in `config/ags/lib/overlayOrchestrator.ts`.
- `command-palette` has visual priority over other overlays.
- `control-center` and `spotify` must respect the existing dynamic overlay
  layout.
- For changes touching overlays, `safeText`, or AGS QA flow, use
  `.github/instructions/ags-runtime-contract.instructions.md` as the runtime
  contract.
- Do not touch `config/ags/private` without explicit confirmation.

## Validation

- TypeScript changes:
  - `npm run typecheck`
  - `npm run lint`
  - `bash ../../bootstrap/ags-smoke.sh` after explicit confirmation because it
    may affect the live AGS session
- SCSS or visual changes:
  - `npm run lint`
  - `bash ../../bootstrap/qa.sh` after explicit confirmation because it restarts
    the live AGS service
- Scripts under `config/ags/scripts`:
  - `bash -n <script>`
  - test `--help` or `--dry-run` when available

## Local rules

- Keep API and UX stable unless explicitly requested.
- Prefer existing local patterns over new abstractions.
- Do not declare smoke or QA as passing unless it was actually run.
