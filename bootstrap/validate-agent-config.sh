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
  "docs/architecture/agent-harness.md"
  "docs/operations/change-log.md"
)

for relative_path in "${required_files[@]}"; do
  require_file "$relative_path"
done

grep -q 'P0' "$REPO_DIR/AGENTS.md" || fail "priority model is missing"
grep -q 'R3' "$REPO_DIR/AGENTS.md" || fail "risk model is missing"
grep -q '10 Projects/dotfiles' "$REPO_DIR/AGENTS.md" || fail "Obsidian write scope is missing"
if [[ -d "$REPO_DIR/.github" ]]; then
  fail "legacy .github agent contracts remain; remove them after migration"
fi

if ((FAILURES > 0)); then
  echo "[agent-config] $FAILURES error(s)" >&2
  exit 1
fi

echo "[agent-config] PASS: native AGENTS.md harness and documentation contracts"
