---
applyTo: "bootstrap/**"
---

# Bootstrap instructions

These rules apply to operational scripts.

## Script contracts

- Scripts should be safe to run more than once when reasonable.
- Prefer `--help`, `--dry-run`, or non-destructive checks for validation.
- Do not execute `bootstrap/deploy.sh` without explicit confirmation.
- Do not install packages, update the system, or perform rollback without
  explicit confirmation.
- Do not hide command errors with silent redirection unless the script already
  has a documented reason.

## Validation

- For modified shell scripts:
  - `bash -n <script>`
  - test `--help` or `--dry-run` when available
- If the script affects AGS or Hyprland runtime:
  - `bash bootstrap/qa.sh` from the repository root only after explicit
    confirmation because it mutates the live AGS session

## Local rules

- Clearly report validations that could not run because of the environment.
