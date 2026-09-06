---
applyTo: "**"
---

# Repository governance

This contract defines authority, priority, risk, handoffs, and completion for all
agents in this repository. Safety rules in this file override specialist
preferences and workflow shortcuts.

## Authority model

- The Orquestador Dotfiles owns the task from intake to final report.
- Specialists own analysis and edits only inside their declared scope.
- One agent owns each file at a time. Cross-area edits return to the
  orchestrator for integration.
- Specialists may recommend broader work but must not expand scope themselves.
- Resolve conflicts in this order: user intent, safety and secrets, runtime
  stability, repository contracts, requested behavior, visual polish.

## Priority model

- `P0`: secret exposure, data loss, destructive behavior, boot/session failure,
  or an active security risk. Stop lower-priority work.
- `P1`: reproducible regression, crash, broken core workflow, or failed required
  validation. Fix before enhancements.
- `P2`: maintainability, observability, documentation drift, accessibility, or
  high-impact UX debt.
- `P3`: optional polish, experimentation, or convenience.

Work highest priority first. Do not mix `P3` work into a `P0` or `P1` fix.

## Risk and authorization

- `R0`: reads, searches, diffs, and static inspection. Allowed.
- `R1`: scoped repository edits and static validation. Allowed when implied by
  the request.
- `R2`: live-session mutation, service restart, Hyprland reload, deploy, or
  external documentation write. Require explicit request or confirmation.
- `R3`: package install, system update, rollback, destructive Git, secret access,
  commit, push, tag, or broad deletion/move. Always require explicit
  confirmation for the exact action.

Authorization for one action does not authorize adjacent actions. Prefer a
static check over a live-session check unless runtime evidence is necessary.

## Handoff contract

Every specialist handoff to the orchestrator must contain:

- priority and risk level
- owned paths and files changed
- evidence or root cause
- validations run, with exact pass/fail/not-run state
- unresolved risks and the next recommended action

The orchestrator integrates conflicting recommendations and is the only agent
that declares the repository task complete.

## Completion gate

A task is complete only when:

- requested behavior or documentation is delivered
- scope and existing user changes were preserved
- proportional validations ran, or blockers are explicit
- no known `P0` or task-related `P1` remains
- repository docs and Obsidian were synchronized when the documentation
  contract requires it
- the final report distinguishes changed, validated, not run, and remaining risk
