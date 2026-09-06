---
applyTo: "config/hypr/**"
---

# Hyprland instructions

These rules apply to Hyprland configuration and scripts.

## Configuration contracts

- Keep configuration modular under `conf.d`.
- Avoid global changes when a setting can stay scoped to one module.
- Preserve visible behavior during refactors.
- Document any change that affects binds, window rules, input, animations,
  decoration, monitors, or workspaces.

## Validation

- Review modified configuration for syntax and coherence.
- Use `hyprctl reload` only with explicit user confirmation because it reloads
  the active session.
- If the change affects AGS integration, run the proportional AGS validation.

## Local rules

- Do not revert existing Hyprland changes you did not make.
- Do not move large blocks between files without confirmation.
- Keep module names and ordering readable to support manual rollback.
