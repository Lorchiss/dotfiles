# Agent harness

## Purpose

The repository uses Codex as the primary orchestrator. The harness preserves
the useful semantics of the former GitHub Copilot setup while reducing policy
duplication and keeping runtime knowledge close to the architecture it governs.

`AGENTS.md` is the single entry contract for governance, safety, workflow,
authorization, ownership, and validation. The files under `.github/` are kept
as compatibility and migration references; they are not a second authority.

## Stable responsibilities

| Responsibility | Owned area | Evidence and gate |
| --- | --- | --- |
| Quickshell runtime | `config/quickshell/**`, shell units | `bootstrap/quickshell-check.sh` |
| Hyprland session | `config/hypr/**` | static review; reload only with authorization |
| AGS recovery | `config/ags/**`, AGS units | typecheck/lint; live smoke only with authorization |
| Bootstrap and QA | `bootstrap/**`, deploy and diagnostics | `bash -n`, help/dry-run, dependency checks |
| Documentation | `README.md`, `docs/**`, curated Obsidian note | repository evidence and sync report |

These are responsibilities, not mandatory sub-agents. Codex may handle several
areas in one task when ownership and validation remain explicit.

## Request lifecycle

```text
objective -> AGENTS.md -> architecture contract -> active plan
          -> ownership -> implementation -> deterministic validation
          -> independent review -> documentation sync -> local record
```

The final record belongs in `docs/operations/change-log.md`. A commit records a
completed local state; a push is an independent remote backup action.

## Migration decisions

- P0–P3 priority and R0–R3 risk remain useful and are centralized in `AGENTS.md`.
- Path-specific Copilot instructions remain historical until their content is
  folded into an architecture or operations document with one clear authority.
- Handoffs are concise evidence packets: priority/risk, owned paths, cause or
  rationale, validations, unresolved risk, and next action.
- Repeated policy should become a deterministic script check where practical.
- New agents are justified only by a stable responsibility boundary; technology
  or directory count alone is insufficient.

## Current migration state

The native contract is active for new Codex work. The legacy `.github` profiles
still describe specialist details and are validated for internal consistency.
The next cleanup pass can retire duplicated text after comparing each contract
against `AGENTS.md` and this document.
