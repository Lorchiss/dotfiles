---
applyTo: "README.md,docs/**,.github/**"
---

# Documentation and Obsidian synchronization

The Git repository is the technical source of truth. Obsidian is the curated
project knowledge layer and must not become a second, conflicting source.

## When synchronization is required

Update the Dotfiles project notes in Obsidian when a task materially changes:

- architecture, component ownership, or entry points
- startup, deploy, recovery, maintenance, or QA flows
- safety restrictions, risks, decisions, or agent governance
- commands that operators are expected to run
- release state or known operational limitations

Typographic fixes and internal code changes with no operational consequence do
not require an Obsidian update.

## Allowed Obsidian scope

- Read before writing.
- Restrict writes to `10 Projects/dotfiles/**` unless the user explicitly asks
  for a decision record elsewhere in the vault.
- Preserve frontmatter, manual analysis, links, and unrelated sections.
- Update the smallest relevant note; do not regenerate the whole project folder.
- Never copy secrets, tokens, local private values, logs with credentials, or
  mutable state into Obsidian.
- Record facts verified from the repository. Label assumptions and pending
  validation explicitly.

## Synchronization sequence

1. Finish repository edits and static validation.
2. Identify which project facts changed.
3. Read the target Obsidian note or notes.
4. Apply a focused update inside `10 Projects/dotfiles/**`.
5. Read back or otherwise verify the resulting note.
6. Report notes updated, notes intentionally skipped, and any sync blocker.

If Obsidian is unavailable, repository work may finish, but documentation sync
must be reported as pending. A release that materially changes operations is not
fully documented until this sync is complete.
