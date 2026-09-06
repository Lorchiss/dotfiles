---
applyTo: "**"
---

# Task workflow instructions

Use these workflows after the orchestrator assigns priority and risk using
`.github/instructions/repository-governance.instructions.md`. If a task mixes
categories, handle them in this order: bugfix, minimum refactor needed, UI
polish, documentation synchronization, release.

## Classification cues

- Bugfix: `quiero arreglar un bug`, `hay un error`, `algo se rompió`,
  `no funciona`, broken logs, crashes, incorrect behavior, or regressions.
- UI polish: visual clarity, spacing, hierarchy, interaction, readability,
  overlap, or presentation requests.
- Refactor: cleanup, simplification, modularization, technical debt, or internal
  structure changes without intended visible behavior changes.
- Release: commit, push, tag, stable closure, pre-release checks, or publish
  requests.
- Documentation: repository docs, operating contracts, decisions, risks, or
  Obsidian synchronization.

## Bugfix workflow

Goal: fix a bug with the smallest safe change and no regressions.

- Input to identify: symptom, context, and allowed scope.
- Reproduce or confirm the bug when the environment permits it.
- Isolate root cause before changing code.
- Apply the minimum sufficient fix.
- Validate with relevant smoke, QA, and logs.
- Report root cause, changed files, final result, and remaining risk.

Completion checklist:

- Bug reproduced or otherwise confirmed.
- Root cause confirmed.
- Minimal fix applied.
- Relevant smoke/QA/log checks run or clearly reported as not run.
- No new critical warnings introduced.

## UI polish workflow

Goal: improve visual clarity and user experience without breaking behavior.

- Capture current state when practical, using screenshots or concrete UI
  observations.
- Prioritize one to three highest-impact improvements.
- Keep visual changes small and consistent with existing tokens and patterns.
- Check hierarchy, spacing, hover/active/focus states, visible text, and overlap.
- Validate in real runtime when available.
- Report what improved for the user and what remains for a later pass.

Completion checklist:

- The UI reads clearly at a glance.
- No incoherent overlap or clipped technical text is visible.
- Visual integration is consistent with the existing system.
- Relevant smoke/QA gates pass or are reported as not run.

## Refactor workflow

Goal: improve internal structure without changing visible behavior.

- Define the behavior that must remain unchanged before editing.
- Refactor in small steps.
- Prefer existing local patterns over new abstractions.
- Keep changes scoped to real debt reduction.
- Validate after the change.
- Report what was simplified, what risk was reduced, and what remains.

Completion checklist:

- Visible behavior remains intact.
- Code is more legible or less risky than before.
- Smoke/QA gates pass when relevant, or are reported as not run.
- No unrelated cleanup is mixed into the change.

## Release workflow

Goal: close a stable, traceable, easy-to-revert state.

- Require explicit user confirmation before commit, push, or tag.
- Start from a clear `git status`.
- Run static blocking gates first:
  - `bash bootstrap/validate-agent-config.sh`
  - `bash bootstrap/check-deps.sh --strict`
- After explicit confirmation, run live-session gates when relevant:
  - `bash bootstrap/ags-smoke.sh`
  - `bash bootstrap/qa.sh`
- Verify logs and visual state when runtime is available.
- Commit with a clear message only after confirmation.
- Push only after confirmation.
- Tag only if requested or confirmed.

Completion checklist:

- Working tree state is understood.
- Blocking gates are green or blockers are explicitly documented.
- Required repository and Obsidian documentation is synchronized.
- Commit, push, and tag actions were confirmed before execution.
- Final output includes commit, tag if any, and state.

## Documentation workflow

Goal: keep repository documentation and Obsidian aligned without creating two
sources of truth.

- Derive facts from repository files and validation evidence.
- Update repository documentation first.
- Use `.github/instructions/documentation.instructions.md` to decide whether an
  Obsidian update is required.
- Read target notes before writing and limit changes to the Dotfiles project.
- Verify the resulting note and report synchronization state.

Completion checklist:

- Changed behavior, architecture, commands, decisions, and risks are documented.
- Obsidian was updated when required, or its unavailability is explicit.
- No secrets, private values, or unverified claims entered documentation.
