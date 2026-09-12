# Dotfiles repository contract

This repository manages an Arch Linux desktop built around Hyprland and the
canonical Quickshell Polar shell. AGS is retained as a manual recovery shell.
Keep the desktop stable, reversible, traceable, and easy to diagnose.

## Authority and scope

- The user objective and this file are the working contract for Codex.
- Read `git status --short` before editing and preserve existing user changes.
- Keep one owner per file and keep changes within the requested area.
- Repository documentation is the source of truth; Obsidian is curated context
  only, limited to `10 Projects/dotfiles/**` when synchronization is requested.
- Historical Copilot profiles under `.github/` remain reference material during
  migration. Do not add new policy there without updating this contract first.

## Priority and risk

- `P0`: secrets, data loss, destructive behavior, boot/session failure, or an
  active security risk. Stop lower-priority work.
- `P1`: reproducible regression, crash, broken core workflow, or failed required
  validation.
- `P2`: maintainability, observability, documentation drift, accessibility, or
  high-impact UX debt.
- `P3`: polish, experiments, or convenience.

- `R0`: read-only inspection and static checks.
- `R1`: scoped repository edits and static validation.
- `R2`: live-session mutation, reload/restart, deploy, or external writes.
- `R3`: package/system changes, rollback, destructive Git, commit, push, tag,
  secret access, or broad moves/deletions.

State priority and risk before mutation. Ask before R2 or R3 actions unless the
user has explicitly authorized that exact action.

## Workflow

1. Classify the task as bugfix, refactor, UI polish, operations, documentation,
   or release; resolve mixed work in that order.
2. Inspect architecture and runtime contracts before editing.
3. Make the smallest reversible change and assign ownership by path:
   Quickshell, Hyprland, AGS recovery, bootstrap/QA, or documentation.
4. Run deterministic validation proportional to the touched paths. Never claim
   a gate passed unless it ran; report blocked checks as not run.
5. Update repository docs when behavior, architecture, operations, or decisions
   change. Synchronize Obsidian only when its documentation contract applies.
6. For completed work, record the result in `docs/operations/change-log.md` and
   create a local commit when the user authorizes commits. Push is separate.

## Runtime boundaries

- Quickshell owns the active bar and starts through the Hyprland environment
  wrapper. Keep AGS and legacy prototypes out of automatic startup.
- Do not reload Hyprland, restart desktop services, deploy, install packages,
  or run destructive rollback without explicit authorization.
- Do not edit `config/ags/private` or expose secrets.
- Prefer `--help`, `--dry-run`, static checks, and scan-before-mutate flows.

## Validation map

- Agent/contracts: `bash bootstrap/validate-agent-config.sh`
- Dependencies: `bash bootstrap/check-deps.sh --strict`
- Quickshell: `bash bootstrap/quickshell-check.sh`
- Shell: `bash -n <script>` plus its help/dry-run mode.
- AGS TypeScript: `cd config/ags && npm run typecheck && npm run lint`.
- Live-session gates (`ags-smoke.sh`, `qa.sh`, reloads): only after explicit
  authorization.

Final reports state priority/risk, changed paths, validations with exact status,
documentation synchronization, and unresolved risk.
