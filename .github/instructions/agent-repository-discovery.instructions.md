---
applyTo: ".github/agents/**/*.agent.md,.github/instructions/**/*.instructions.md"
---

# Agent repository discovery instructions

Use this rubric when evaluating external repositories that contain AI agents,
skills, prompts, workflow packs, or reusable agent conventions.

## What makes a repository worth reusing

High-signal repositories usually have:

- A clear taxonomy of agents by domain or workflow.
- Stable metadata per agent: `name`, `description`, and optional tool/scope
  fields.
- Agent bodies with role, mission, constraints, workflow, deliverables, and
  success criteria.
- Installation or conversion scripts for multiple tools.
- CI or linting for agent structure.
- Examples showing how agents collaborate.
- License information that permits reuse.
- Active maintenance signals: recent commits, issue/PR activity, or visible
  contribution rules.

Low-signal repositories usually have:

- Prompt dumps without structure.
- Agents that are mostly personality text with no operating constraints.
- No license or unclear reuse terms.
- No validation, linting, examples, or integration path.
- Tool assumptions that do not match this repository.
- Very broad agents that duplicate the default assistant instead of specializing
  a workflow.

## Scoring rubric

Score from 0 to 3 in each category.

| Category | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Taxonomy | none | loose list | clear categories | categories plus examples |
| Metadata | absent | inconsistent | mostly stable | stable and tool-aware |
| Agent quality | generic | useful fragments | strong specialist behavior | specialist plus constraints and deliverables |
| Portability | locked to one tool | manual copy only | scripts or docs | multi-tool conversion/install support |
| Validation | none | manual guidance | basic lint/checks | CI-backed checks |
| Maintenance | stale/unknown | low activity | moderate | active with contribution flow |
| Fit for this repo | unrelated | reference only | adaptable | directly useful |

Decision:

- `adopt`: 17-21 points and license permits reuse.
- `adapt`: 12-16 points or strong content with local format changes needed.
- `reference`: 7-11 points, useful ideas but not reusable as-is.
- `reject`: 0-6 points or unsafe/license-blocked.

## Local adaptation rules

- Put executable agent profiles in `.github/agents/*.agent.md`.
- Put reusable rubrics, workflow rules, and broad instructions in
  `.github/instructions/*.instructions.md`.
- Keep project-specific agents shorter and stricter than broad upstream agents.
- Prefer one narrow agent over importing a large generic pack.
- Attribute external inspiration in the final report when content or structure
  meaningfully comes from a repository.
- Do not place LLM-only `.md` files outside `.github`.

## Evaluation output template

```markdown
## Repository Evaluation

- **Repository**: [name and URL]
- **What it is**: [one sentence]
- **Decision**: adopt | adapt | reference | reject
- **Score**: [N]/21
- **Best reusable parts**: [agents, scripts, conventions, examples]
- **Risks**: [license, maintenance, quality, tool fit]
- **Recommended local action**: [files to add/update or no action]
```
