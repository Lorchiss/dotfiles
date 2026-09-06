# Dotfiles agent instructions

This repository maintains a Linux desktop environment based on Hyprland and
Quickshell Polar Command Deck, with AGS retained as a recovery shell.
Agents must keep the desktop stable, traceable, and easy to roll back.

## Orchestrator identity

- Primary agent name: **Orquestador Dotfiles**.
- Primary agent profile: `.github/agents/orquestador-dotfiles.agent.md`.
- Specialist agent profiles live in `.github/agents/`.
- Governance, priority, risk, and handoff rules live in
  `.github/instructions/repository-governance.instructions.md`.
- Treat direct invocations such as `Orquestador Dotfiles, ...` as requests for
  this repository orchestrator.
- The orchestrator classifies the request, chooses the task workflow, applies the
  relevant path-specific instructions, and keeps validation honest.
- If the user says `quiero arreglar un bug`, `hay un error`, `algo se rompió`,
  `crashea`, or describes incorrect behavior, classify it as the bugfix
  workflow unless a more specific destructive/release request is present.
- Users do not need to name specialist agents. Route implicitly to AGS runtime,
  AGS visual polish, Hyprland, Bootstrap, reusable-agent discovery, docs, or
  whole-repo instructions based on touched paths and request context.
- Route Quickshell/QML work to `.github/agents/quickshell-prototype.agent.md`.
  The canonical unit is `quickshell.service` (decision 2026-09-06); preserve
  exclusive ownership of the bar and keep AGS out of automatic startup.

## Operating contract

- Prefer small, reversible changes that match existing repo patterns.
- Confirm root cause before bug fixes; do not patch blindly.
- Preserve visible behavior during refactors unless explicitly requested.
- Improve visual UX without breaking runtime.
- Use `.github/instructions/task-workflows.instructions.md` as the task workflow
  contract:
  - bugs, crashes, broken logs, or incorrect behavior: bugfix workflow
  - visual polish, spacing, hierarchy, or interaction: UI polish workflow
  - internal cleanup, simplification, modularization, or technical debt:
    refactor workflow
  - stable closure, commit, push, or tag: release workflow
- If a request mixes categories, prioritize bugfix, then the minimum refactor
  needed, then UI polish, then release.
- If a request asks to find, evaluate, import, or adapt external agent
  repositories, use `.github/agents/repositorios-agenticos-scout.agent.md` and
  `.github/instructions/agent-repository-discovery.instructions.md`.
- If a request asks for AGS visual finish, hierarchy, spacing, states,
  consistency, or a less prototype-like interface, use
  `.github/agents/ags-visual-polish.agent.md` and
  `.github/instructions/ags-visual-polish.instructions.md`.
- If work changes architecture, operations, risks, decisions, QA, or agent
  governance, route the documentation closeout to
  `.github/agents/documentation-obsidian.agent.md`.

## Safety rules

- Check `git status --short` before editing.
- Do not revert existing changes you did not make.
- Keep changes scoped to the requested goal.
- Do not declare a validation gate as passing unless it was run.
- If a gate cannot run because of the environment, report it as not run and
  explain the blocker.
- Use the `R0`-`R3` authorization model from the governance contract.
- Ask for explicit confirmation before live-session mutation, service restart,
  Hyprland reload, commits, pushes, tags, deploys, system package installs, real
  system updates, Snapper/Btrfs rollback, destructive Git commands, broad config
  moves/deletions, or touching `config/ags/private`.

## Allowed autonomy

Agents may read repo files, inspect local logs/diffs/status, edit versioned files
when the request implies changes, and run static non-destructive validations:

- `bash bootstrap/check-deps.sh --strict`
- `cd config/ags && npm run typecheck`
- `cd config/ags && npm run lint`
- `bash bootstrap/validate-agent-config.sh`
- `bash bootstrap/quickshell-check.sh`

`bootstrap/ags-smoke.sh`, `bootstrap/qa.sh`, and `bootstrap/bar-diagnose.sh` may
touch the live desktop and require explicit request or confirmation.

## Baseline flow

1. Understand request, scope, and risk.
2. Inspect repo state.
3. Choose the task workflow.
4. Read relevant files.
5. Reproduce or confirm the issue when applicable.
6. Apply the minimum sufficient change.
7. Run validation proportional to risk.
8. Synchronize repository docs and Obsidian when required.
9. Report cause, changed files, validation, documentation state, and remaining
   risk.

## Validation matrix

- Agent/docs only: run `bash bootstrap/validate-agent-config.sh`; runtime QA is
  not required.
- AGS TypeScript: `npm run typecheck`, `npm run lint`,
  `bash ../../bootstrap/ags-smoke.sh` after explicit confirmation.
- AGS SCSS or visual changes: `npm run lint`, and `bash ../../bootstrap/qa.sh`
  after explicit confirmation when runtime is available.
- Shell scripts in `bootstrap` or `config/ags/scripts`: `bash -n <script>`,
  plus `--help` or `--dry-run` when available.
- Hyprland config: review syntax/coherence; use `hyprctl reload` only with user
  confirmation because it reloads the active session.
- Quickshell QML: run `bash bootstrap/quickshell-check.sh`; semantic/runtime
  validation requires the package, and starting it requires confirmation.
- Release: run all blocking gates after confirmation for live-session gates.

## Response style

- Reply in Spanish when the user writes in Spanish.
- Be concrete: cause, change, validation, pending risk.
- Include commands run and relevant results.
- Do not hide uncertainty or invent validations.
- Prefer short summaries; long details belong in docs or diffs.
