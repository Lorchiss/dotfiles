---
applyTo: "config/ags/**"
---

# AGS visual polish instructions

Use these rules for AGS visual polish requests. Visual polish means improving
finish, hierarchy, spacing, density, states, contrast, and consistency while
preserving behavior.

## Priority surface

- Prioritize Control Center for v1 visual polish.
- Use the bar, Spotify popup, Command Palette, and overlay composition as
  consistency checks.
- When the user asks for a broad pass, identify the top one to three visual
  changes with the highest impact before editing.

## Non-negotiable constraints

- Do not change runtime logic, commands, services, data fetching, monitor/audio
  behavior, or overlay ownership unless explicitly requested.
- Keep visual tokens in `config/ags/style.scss`.
- Prefer existing SCSS classes and local patterns over inline style changes.
- Keep dynamic visible text behind `safeText(value, fallback, module, field)`.
- Preserve the overlay orchestration contract from
  `.github/instructions/ags-runtime-contract.instructions.md`.
- Do not touch `config/ags/private`.

## Visual quality checklist

- Hierarchy: section titles, labels, primary controls, and secondary metadata
  are clearly distinguishable.
- Spacing: controls breathe without wasting space; repeated groups use
  consistent gaps.
- Density: operational panels stay compact and scannable.
- States: hover, active, selected, busy, success, error, and focus states are
  visible and consistent.
- Text: no clipping, overlap, `[object]`, `undefined`, `null`, GTK/GObject text,
  or cramped labels.
- Surfaces: avoid nested cards, decorative wrappers, and visual noise that
  competes with controls.
- Shape: use stable dimensions for buttons, chips, counters, tabs, and compact
  controls so states do not shift layout.
- Contrast: text and icons remain readable in dark and light theme tokens.

## Control Center defaults

- Keep tabs compact and obvious.
- Group related controls with consistent spacing and visual weight.
- Prefer icon or icon-plus-short-label controls for actions.
- Use concise labels; do not add explanatory paragraphs inside the UI.
- For destructive or session actions, keep danger styling clear but restrained.

## Validation

- Instruction-only `.github` changes require reference checks only.
- SCSS-only changes require `cd config/ags && npm run lint`.
- TypeScript widget changes require `cd config/ags && npm run typecheck` and
  `npm run lint`.
- Runtime visual changes should run `bash bootstrap/ags-smoke.sh` and
  `bash bootstrap/qa.sh` only after explicit confirmation because they may
  restart or otherwise affect the live session.
