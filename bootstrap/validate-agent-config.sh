#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

fail() {
  echo "[agent-config] FAIL: $*" >&2
  FAILURES=$((FAILURES + 1))
}

require_file() {
  local relative_path="$1"
  [[ -f "$REPO_DIR/$relative_path" ]] || fail "missing $relative_path"
}

required_files=(
  "AGENTS.md"
  ".github/copilot-instructions.md"
  ".github/agents/orquestador-dotfiles.agent.md"
  ".github/agents/ags-runtime.agent.md"
  ".github/agents/ags-visual-polish.agent.md"
  ".github/agents/bootstrap-qa.agent.md"
  ".github/agents/hyprland-session.agent.md"
  ".github/agents/quickshell-prototype.agent.md"
  ".github/agents/documentation-obsidian.agent.md"
  ".github/instructions/repository-governance.instructions.md"
  ".github/instructions/task-workflows.instructions.md"
  ".github/instructions/documentation.instructions.md"
  ".github/instructions/quickshell.instructions.md"
)

for relative_path in "${required_files[@]}"; do
  require_file "$relative_path"
done

while IFS= read -r agent_file; do
  first_line="$(head -n 1 "$agent_file")"
  [[ "$first_line" == "---" ]] || fail "missing frontmatter in ${agent_file#"$REPO_DIR/"}"
  grep -q '^name: .\+' "$agent_file" \
    || fail "missing name in ${agent_file#"$REPO_DIR/"}"
  grep -q '^description: .\+' "$agent_file" \
    || fail "missing description in ${agent_file#"$REPO_DIR/"}"
done < <(find "$REPO_DIR/.github/agents" -maxdepth 1 -type f -name '*.agent.md' | sort)

duplicate_names="$({
  grep -h '^name: ' "$REPO_DIR"/.github/agents/*.agent.md || true
} | sed 's/^name: //' | sort | uniq -d)"
if [[ -n "$duplicate_names" ]]; then
  fail "duplicate agent names: $duplicate_names"
fi

while IFS= read -r reference; do
  [[ -z "$reference" ]] && continue
  [[ "$reference" == *'*'* || "$reference" == *','* ]] && continue
  [[ -e "$REPO_DIR/$reference" ]] || fail "broken .github reference: $reference"
done < <(
  rg --no-filename -o '\.github/(agents|instructions)/[^` )"]+' \
    "$REPO_DIR/.github/copilot-instructions.md" \
    "$REPO_DIR/.github/agents" \
    "$REPO_DIR/.github/instructions" \
    | sed 's/[.,:]$//' \
    | sort -u
)

if rg -n 'runbooks/(BUGFIX|REFACTOR|RELEASE|UI-POLISH)\.md' "$REPO_DIR/.github" >/dev/null; then
  fail "legacy runbook reference found under .github"
fi

grep -q 'P0' "$REPO_DIR/.github/instructions/repository-governance.instructions.md" \
  || fail "priority model is missing"
grep -q 'R3' "$REPO_DIR/.github/instructions/repository-governance.instructions.md" \
  || fail "risk model is missing"
grep -q '10 Projects/dotfiles' "$REPO_DIR/.github/instructions/documentation.instructions.md" \
  || fail "Obsidian write scope is missing"

if ((FAILURES > 0)); then
  echo "[agent-config] $FAILURES error(s)" >&2
  exit 1
fi

agent_count="$(find "$REPO_DIR/.github/agents" -maxdepth 1 -type f -name '*.agent.md' | wc -l)"
instruction_count="$(find "$REPO_DIR/.github/instructions" -maxdepth 1 -type f -name '*.instructions.md' | wc -l)"
echo "[agent-config] PASS: $agent_count agents, $instruction_count instruction contracts"
